const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../helpers/bootstrap.cjs');
const jwt = require('jsonwebtoken');
const config = require('../../src/config/server');
const UserModel = require('../../src/database/models/UserModel');
const auth = require('../../src/use-cases/auth.usecase');
const controller = require('../../src/controllers/auth.controller');
const { authenticate, optionalAuth } = require('../../src/middlewares/auth.middleware');
const { versionFilter } = require('../../src/utils/session.util');

function account(version = 0) {
  return {
    _id: 'account', sessionVersion: version, authProvider: 'local',
    password: 'old-hash', refreshTokens: [],
    comparePassword: async password => password === 'old-password',
    toJSON: () => ({ id: 'account', name: 'Person' }),
    save: async () => { throw new Error('Session issuance must not save a stale document'); },
  };
}

function matches(state, filter) {
  return state._id === filter._id &&
    (filter.$or ? state.sessionVersion === undefined || state.sessionVersion === 0 : state.sessionVersion === filter.sessionVersion) &&
    (filter.password === undefined || filter.password === state.password) &&
    (filter['refreshTokens.token'] === undefined || state.refreshTokens.some(rt => rt.token === filter['refreshTokens.token']));
}

function persistence(t, state, beforeUpdate = async () => {}) {
  return t.mock.method(UserModel, 'updateOne', async (filter, update) => {
    await beforeUpdate();
    if (!matches(state, filter)) return { matchedCount: 0 };
    if (update.$push) state.refreshTokens.push(update.$push.refreshTokens);
    if (update.$pull) state.refreshTokens = state.refreshTokens.filter(rt => rt.token !== update.$pull.refreshTokens.token);
    if (update.$addToSet && !state.refreshTokens.some(rt => rt.token === update.$addToSet.refreshTokens.token)) {
      state.refreshTokens.push(update.$addToSet.refreshTokens);
    }
    return { matchedCount: 1 };
  });
}

function revoke(state) {
  state.password = 'new-hash';
  state.sessionVersion = (state.sessionVersion ?? 0) + 1;
  state.refreshTokens = [];
}

async function request(token, middleware = authenticate) {
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  let next = false;
  await middleware(req, res, () => { next = true; });
  return { req, res, next };
}

const sign = payload => jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' });

test('access validation supports legacy sessions, rejects both devices after revocation and leaves other accounts valid', async t => {
  const state = account(undefined);
  delete state.sessionVersion;
  const other = { ...account(0), _id: 'other' };
  t.mock.method(UserModel, 'findById', async id => id === 'other' ? other : state);
  const legacy = sign({ id: state._id });
  const device = auth.generateToken(state._id, 0);
  const unaffected = auth.generateToken(other._id, 0);
  assert.equal((await request(legacy)).next, true);
  assert.equal((await request(device)).next, true);
  revoke(state);
  for (const token of [legacy, device]) {
    assert.equal((await request(token)).res.code, 401);
    const optional = await request(token, optionalAuth);
    assert.equal(optional.next, true);
    assert.equal(optional.req.user, undefined);
  }
  assert.equal((await request(unaffected)).next, true);
  assert.equal((await request(auth.generateToken(state._id, 1))).next, true);
});

test('access middleware rejects refresh, expired, future and malformed-version tokens', async t => {
  t.mock.method(UserModel, 'findById', async () => account(0));
  const tokens = [
    auth.generateRefreshToken('account', 0),
    jwt.sign({ id: 'account' }, config.jwtSecret, { expiresIn: -1 }),
    jwt.sign({ id: 'account' }, config.jwtSecret, { notBefore: '1h' }),
    sign({ id: 'account', sessionVersion: null }),
    sign({ id: 'account', sessionVersion: '0' }),
    sign({ id: 'account', type: 'unknown' }),
  ];
  for (const token of tokens) {
    assert.equal((await request(token)).res.code, 401);
    assert.equal((await request(token, optionalAuth)).req.user, undefined);
  }
});

test('signup, login, OAuth use case and callback issue typed versioned tokens without document saves', async t => {
  const state = account(3);
  persistence(t, state);
  t.mock.method(UserModel, 'findOne', filter => filter.providerId ? Promise.resolve(state) : { select: async () => state });
  t.mock.method(UserModel, 'create', async () => state);
  const check = result => {
    for (const [key, type] of [['token', 'access'], ['refreshToken', 'refresh']]) {
      const decoded = jwt.verify(result[key], config.jwtSecret);
      assert.equal(decoded.sessionVersion, 3);
      assert.equal(decoded.type, type);
    }
  };
  check(await auth.login({ email: 'person@example.com', password: 'old-password' }));
  check(await auth.oauthLogin({ providerId: 'provider', authProvider: 'google' }));
  let redirect;
  await controller.oauthCallback({ user: state }, { redirect(url) { redirect = new URL(url); } });
  check(Object.fromEntries(redirect.searchParams));
  t.mock.method(UserModel, 'findOne', async () => null);
  check(await auth.signup({ name: 'Person', email: 'person@example.com', password: 'valid-password' }));
  assert.equal(state.refreshTokens.length, 4);
});

test('login paused before persistence cannot issue a session after recovery commits', async t => {
  const state = account(0);
  const observed = { ...state };
  t.mock.method(UserModel, 'findOne', () => ({ select: async () => observed }));
  let release;
  let entered;
  const atWrite = new Promise(resolve => { entered = resolve; });
  const resume = new Promise(resolve => { release = resolve; });
  persistence(t, state, async () => { entered(); await resume; });
  const pending = auth.login({ email: 'person@example.com', password: 'old-password' });
  await atWrite;
  revoke(state);
  release();
  await assert.rejects(pending, { status: 401 });
  assert.deepEqual(state.refreshTokens, []);
});

test('refresh preserves the observed version and fails closed when recovery overlaps persistence', async t => {
  const state = account(0);
  const token = auth.generateRefreshToken(state._id, 0);
  state.refreshTokens = [{ token }];
  const observed = { ...state, refreshTokens: [...state.refreshTokens] };
  t.mock.method(UserModel, 'findById', async () => observed);
  persistence(t, state, async () => revoke(state));
  await assert.rejects(auth.refreshAccessToken(token), { status: 401 });
  assert.deepEqual(state.refreshTokens, []);
});

test('legacy refresh works only at version zero; revoked, wrong-type and expired refresh return 401', async t => {
  const state = account(0);
  delete state.sessionVersion;
  const legacy = sign({ id: state._id, type: 'refresh' });
  state.refreshTokens = [{ token: legacy }];
  t.mock.method(UserModel, 'findById', async () => state);
  persistence(t, state);
  const result = await auth.refreshAccessToken(legacy);
  assert.equal(jwt.verify(result.token, config.jwtSecret).sessionVersion, 0);
  revoke(state);
  for (const token of [legacy, auth.generateToken(state._id, 1), jwt.sign({ id: state._id, type: 'refresh' }, config.jwtSecret, { expiresIn: -1 })]) {
    await assert.rejects(auth.refreshAccessToken(token), { status: 401 });
  }
  let forwarded;
  await controller.refreshToken({ body: { refreshToken: legacy } }, {}, error => { forwarded = error; });
  assert.equal(forwarded.status, 401);
});

test('stale OAuth callback cannot restore sessions; logout only pulls the submitted token', async t => {
  const state = account(0);
  const stale = { ...state };
  const update = persistence(t, state);
  revoke(state);
  let location;
  t.mock.method(console, 'error', () => {});
  await controller.oauthCallback({ user: stale }, { redirect(url) { location = new URL(url); } });
  assert.equal(location.searchParams.has('token'), false);
  assert.equal(location.searchParams.has('error'), true);
  assert.deepEqual(state.refreshTokens, []);
  // A logout racing recovery uses an atomic pull, never a replacement array.
  t.mock.method(UserModel, 'updateOne', async (filter, change) => {
    assert.deepEqual(filter, { _id: state._id });
    assert.deepEqual(change, { $pull: { refreshTokens: { token: 'old-refresh' } } });
    return { matchedCount: 1 };
  });
  assert.deepEqual(await auth.logout(state._id, 'old-refresh'), { message: 'Logged out successfully' });
  assert.equal(update.mock.calls[0].arguments[0].$or.length, 2);
});

test('version filtering covers persisted legacy accounts and serializers keep session state private', () => {
  assert.deepEqual(versionFilter(undefined), { $or: [{ sessionVersion: 0 }, { sessionVersion: { $exists: false } }] });
  assert.deepEqual(versionFilter(2), { sessionVersion: 2 });
  const user = new UserModel({ name: 'Person', email: 'person@example.com', sessionVersion: 2 });
  assert.equal('sessionVersion' in user.toJSON(), false);
  assert.equal('sessionVersion' in user.getPublicProfile(), false);
});

test('normal profile updates preserve the public response and do not modify session fields', async t => {
  const state = account(2);
  state.save = async () => {
    assert.equal(state.name, 'Updated');
    assert.equal(state.sessionVersion, 2);
    assert.deepEqual(state.refreshTokens, []);
  };
  t.mock.method(UserModel, 'findById', async () => state);
  assert.deepEqual(await auth.updateProfile(state._id, { name: 'Updated', sessionVersion: 99, refreshTokens: ['injected'] }), state.toJSON());
});
