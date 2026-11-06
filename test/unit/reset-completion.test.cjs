const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../helpers/bootstrap.cjs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../../src/database/models/UserModel');
const auth = require('../../src/use-cases/auth.usecase');
const controller = require('../../src/controllers/auth.controller');
const { authenticate, optionalAuth } = require('../../src/middlewares/auth.middleware');
const { PasswordRecoveryUseCase, hashToken } = require('../../src/use-cases/password-recovery.usecase');
const token = 'a'.repeat(64);

async function fixture(t) {
  const state = {
    _id: 'account', authProvider: 'local', password: await bcrypt.hash('old-password', 4),
    sessionVersion: 0, refreshTokens: [], passwordResetTokenHash: hashToken(token),
    passwordResetExpiresAt: new Date(Date.now() + 60000),
    toJSON: () => ({ id: 'account' }),
  };
  const matches = filter => {
    if (filter._id && filter._id !== state._id) return false;
    if (filter.authProvider && filter.authProvider !== state.authProvider) return false;
    if (filter.password && filter.password !== state.password) return false;
    if (filter.sessionVersion !== undefined && filter.sessionVersion !== state.sessionVersion) return false;
    if (filter.$or && state.sessionVersion !== undefined && state.sessionVersion !== 0) return false;
    if (filter.passwordResetTokenHash && filter.passwordResetTokenHash !== state.passwordResetTokenHash) return false;
    if (filter.passwordResetExpiresAt && !(state.passwordResetExpiresAt > filter.passwordResetExpiresAt.$gt)) return false;
    if (filter['refreshTokens.token'] && !state.refreshTokens.some(rt => rt.token === filter['refreshTokens.token'])) return false;
    return true;
  };
  const update = async (filter, change) => {
    if (!matches(filter)) return { matchedCount: 0 };
    Object.assign(state, change.$set);
    for (const key of Object.keys(change.$unset || {})) delete state[key];
    for (const [key, value] of Object.entries(change.$inc || {})) state[key] = (state[key] || 0) + value;
    if (change.$push) state.refreshTokens.push(change.$push.refreshTokens);
    return { matchedCount: 1 };
  };
  t.mock.method(UserModel, 'updateOne', update);
  t.mock.method(UserModel, 'findById', async () => ({ ...state }));
  t.mock.method(UserModel, 'findOne', () => ({ select: async () => {
    const observed = { ...state };
    observed.comparePassword = value => bcrypt.compare(value, observed.password);
    return observed;
  } }));
  return { state, update, recovery: new PasswordRecoveryUseCase() };
}

async function access(token, middleware = authenticate) {
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = { status(code) { this.code = code; return this; }, json() { return this; } };
  let next = false;
  await middleware(req, res, () => { next = true; });
  return { req, res, next };
}

test('actual completion revokes both devices, consumes token, permits only new-password login and returns no credentials', async t => {
  const { state } = await fixture(t);
  const devices = [await auth.issueSession(state), await auth.issueSession(state)];
  let response;
  await controller.resetPassword({ body: { token, newPassword: 'new-password' } }, {
    status(code) { assert.equal(code, 200); return this; },
    json(body) { response = body; },
  }, error => { throw error; });
  assert.deepEqual(response, { status: 'success', message: 'Password has been reset successfully' });
  assert.equal(state.sessionVersion, 1);
  assert.equal(state.passwordResetTokenHash, undefined);
  assert.equal(state.passwordResetExpiresAt, undefined);
  assert.deepEqual(state.refreshTokens, []);
  for (const device of devices) {
    assert.equal((await access(device.token)).res.code, 401);
    assert.equal((await access(device.token, optionalAuth)).req.user, undefined);
    await assert.rejects(auth.refreshAccessToken(device.refreshToken), { status: 401 });
  }
  await assert.rejects(auth.login({ email: 'person@example.test', password: 'old-password' }));
  const fresh = await auth.login({ email: 'person@example.test', password: 'new-password' });
  assert.equal((await access(fresh.token)).next, true);
  await assert.rejects(auth.resetPassword({ token, newPassword: 'another-password' }), { status: 400 });
});

test('invalid, expired and weak-password resets preserve credentials and sessions', async t => {
  const { state, recovery } = await fixture(t);
  const device = await auth.issueSession(state);
  const original = state.password;
  for (const input of [
    { token: 'b'.repeat(64), newPassword: 'new-password' },
    { token, newPassword: 'short' },
    { token: {}, newPassword: 'new-password' },
  ]) await assert.rejects(recovery.complete(input), { status: 400 });
  state.passwordResetExpiresAt = new Date(0);
  await assert.rejects(recovery.complete({ token, newPassword: 'new-password' }), { status: 400 });
  assert.equal(state.password, original);
  assert.equal(state.passwordResetTokenHash, hashToken(token));
  assert.equal(state.sessionVersion, 0);
  assert.equal((await access(device.token)).next, true);
});

test('persistence failure reports no success and leaves the reset and session intact', async t => {
  const { state, recovery } = await fixture(t);
  const device = await auth.issueSession(state);
  const original = state.password;
  t.mock.method(UserModel, 'updateOne', async () => { throw new Error('storage unavailable'); });
  await assert.rejects(recovery.complete({ token, newPassword: 'new-password' }), { status: 500 });
  assert.equal(state.password, original);
  assert.equal(state.passwordResetTokenHash, hashToken(token));
  assert.equal(state.sessionVersion, 0);
  assert.equal((await access(device.token)).next, true);
});

for (const operation of ['login', 'refresh', 'oauth']) {
  test(`actual reset fences ${operation} paused before persistence`, async t => {
    const { state, update, recovery } = await fixture(t);
    const device = await auth.issueSession(state);
    let release;
    let entered;
    const paused = new Promise(resolve => { entered = resolve; });
    const resume = new Promise(resolve => { release = resolve; });
    t.mock.method(UserModel, 'updateOne', async (filter, change) => {
      if (!change.$inc) { entered(); await resume; }
      return update(filter, change);
    });
    const pending = operation === 'login'
      ? auth.login({ email: 'person@example.test', password: 'old-password' })
      : operation === 'refresh' ? auth.refreshAccessToken(device.refreshToken)
        : auth.issueSession({ ...state });
    const rejected = assert.rejects(pending, { status: 401 });
    await paused;
    await recovery.complete({ token, newPassword: 'new-password' });
    release();
    await rejected;
    assert.deepEqual(state.refreshTokens, []);
  });
}

test('repeated refresh preserves stored subdocuments without appending tokens', async t => {
  const { state, update } = await fixture(t);
  const device = await auth.issueSession(state);
  state.refreshTokens[0]._id = 'subdocument-id';
  state.refreshTokens[0].createdAt = new Date(0);
  const before = structuredClone(state.refreshTokens);
  t.mock.method(UserModel, 'updateOne', async (filter, change) => {
    assert.equal(filter['refreshTokens.token'], device.refreshToken);
    assert.equal(change.$addToSet, undefined);
    assert.equal(change.$push, undefined);
    return update(filter, change);
  });
  for (let i = 0; i < 5; i++) {
    const result = await auth.refreshAccessToken(device.refreshToken);
    assert.equal(jwt.decode(result.token).sessionVersion, 0);
  }
  assert.deepEqual(state.refreshTokens, before);
});
