const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const mailFixture = require('../helpers/bootstrap.cjs');
const { readRecoveryConfig } = require('../../src/config/recovery');
const { PasswordRecoveryUseCase, MESSAGE, hashToken } = require('../../src/use-cases/password-recovery.usecase');
const UserModel = require('../../src/database/models/UserModel');
const RecoveryLimitModel = require('../../src/database/models/RecoveryLimitModel');
const mail = require('../../src/services/password-reset-email.service');
const { listen } = require('../helpers/http.cjs');

function fixture(account = { _id: 'user', email: 'person@example.com', authProvider: 'local', password: 'existing-hash' }) {
  const sent = [];
  const logs = [];
  const consumed = [];
  let allowed = true;
  let fail = false;
  const users = {
    async findOneAndUpdate(filter, update) {
      assert.equal(filter.authProvider, 'local');
      assert.deepEqual(filter.password, { $type: 'string', $ne: '' });
      if (!account || account.email !== filter.email || account.authProvider !== 'local' || !account.password) return null;
      Object.assign(account, update.$set);
      return account;
    },
    async updateOne(filter) {
      if (account?.passwordResetTokenHash === filter.passwordResetTokenHash) {
        delete account.passwordResetTokenHash;
        delete account.passwordResetExpiresAt;
      }
    },
  };
  const limits = { async consume(...args) { consumed.push(args); return allowed; } };
  const service = new PasswordRecoveryUseCase({
    users, limits,
    settings: readRecoveryConfig({ PASSWORD_RESET_PAGE_URL: 'https://frontend.example.test/reset' }),
    clock: () => new Date('2026-11-04T12:00:00Z'),
    log: { warn: message => logs.push(message) },
    mail: { async sendPasswordResetEmail(value) {
      if (fail) throw new Error(`secret ${value.token} ${value.pageUrl}`);
      sent.push(value);
      return { success: true };
    } },
  });
  return { service, sent, logs, consumed, account,
    deny() { allowed = false; }, fail() { fail = true; } };
}

const response = { message: MESSAGE };

test('configuration defaults, bounds and trusted URL validation', () => {
  assert.deepEqual(readRecoveryConfig({}), { expiryMinutes: 15, emailLimit: 5, ipLimit: 20, pageUrl: null });
  for (const value of ['15', '30']) assert.equal(readRecoveryConfig({ PASSWORD_RESET_EXPIRY_MINUTES: value }).expiryMinutes, Number(value));
  for (const value of ['14', '31', '15.5', '', 'garbage']) {
    assert.throws(() => readRecoveryConfig({ PASSWORD_RESET_EXPIRY_MINUTES: value }), /Invalid PASSWORD_RESET_EXPIRY_MINUTES/);
  }
  for (const name of ['PASSWORD_RESET_EMAIL_LIMIT', 'PASSWORD_RESET_IP_LIMIT']) {
    for (const value of ['0', '-1', '1.2', 'bad']) assert.throws(() => readRecoveryConfig({ [name]: value }));
    assert.equal(typeof readRecoveryConfig({ [name]: '2' }), 'object');
  }
  for (const value of ['http://host/reset', 'javascript:alert(1)', 'https://user:pass@host/reset', 'https://host/reset?next=evil', 'https://host/reset#fragment']) {
    assert.throws(() => readRecoveryConfig({ PASSWORD_RESET_PAGE_URL: value }), /Invalid PASSWORD_RESET_PAGE_URL/);
  }
});

test('issues hash only, preserves password, uses stored email and replaces previous token at default expiry', async () => {
  const f = fixture();
  assert.deepEqual(await f.service.request({ email: ' PERSON@EXAMPLE.COM ', ip: '127.0.0.1' }), response);
  const first = f.sent[0];
  assert.equal(first.email, f.account.email);
  assert.match(first.token, /^[a-f0-9]{64}$/);
  assert.equal(f.account.passwordResetTokenHash, hashToken(first.token));
  assert.notEqual(f.account.passwordResetTokenHash, first.token);
  assert.equal(f.account.passwordResetExpiresAt.toISOString(), '2026-11-04T12:15:00.000Z');
  assert.equal(f.account.password, 'existing-hash');
  assert.equal(JSON.stringify(f.account).includes(first.token), false);
  assert.deepEqual(f.consumed, [['email', 'person@example.com', 5], ['ip', '127.0.0.1', 20]]);
  await f.service.request({ email: 'person@example.com', ip: '127.0.0.1' });
  assert.notEqual(f.sent[1].token, first.token);
  assert.equal(f.account.passwordResetTokenHash, hashToken(f.sent[1].token));
  assert.notEqual(f.account.passwordResetTokenHash, hashToken(first.token));
});

test('normalizes Gmail aliases identically to express-validator', async () => {
  const f = fixture(null);
  await f.service.request({ email: ' Some.One+tag@GMAIL.COM ', ip: 'ip' });
  assert.equal(f.consumed[0][1], 'someone@gmail.com');
});

test('unknown, passwordless and all social accounts receive identical response without mail or password creation', async () => {
  for (const account of [null,
    { email: 'person@example.com', authProvider: 'local' },
    ...['google', 'github', 'facebook'].map(authProvider => ({ email: 'person@example.com', authProvider, password: 'retained-hash' })),
  ]) {
    const f = fixture(account);
    const before = JSON.stringify(account);
    assert.deepEqual(await f.service.request({ email: 'person@example.com', ip: 'ip' }), response);
    assert.equal(f.sent.length, 0);
    assert.equal(JSON.stringify(account), before);
    assert.equal(f.consumed.length, 2);
  }
});

test('limited requests do not touch accounts, and persistence failures fail closed without leaking errors', async () => {
  const f = fixture();
  f.deny();
  assert.deepEqual(await f.service.request({ email: 'person@example.com', ip: 'ip' }), response);
  assert.equal(f.sent.length, 0);
  assert.equal(f.account.passwordResetTokenHash, undefined);
  f.service.limits.consume = async () => { throw new Error('private database details'); };
  assert.deepEqual(await f.service.request({ email: 'person@example.com', ip: 'ip' }), response);
  assert.deepEqual(f.logs, ['Password reset request failed']);
});

test('delivery failures are uniform and sanitized, and cleanup cannot clear a newer replacement', async () => {
  const f = fixture();
  f.fail();
  assert.deepEqual(await f.service.request({ email: 'person@example.com', ip: 'ip' }), response);
  assert.equal(f.account.password, 'existing-hash');
  assert.equal(f.account.passwordResetTokenHash, undefined);
  assert.deepEqual(f.logs, ['Password reset delivery failed']);
  f.service.mail.sendPasswordResetEmail = async () => {
    f.account.passwordResetTokenHash = 'newer-hash';
    return { success: false };
  };
  await f.service.request({ email: 'person@example.com', ip: 'ip' });
  assert.equal(f.account.passwordResetTokenHash, 'newer-hash');
});

test('SendGrid reset adapter builds trusted link and never exposes provider payloads', async t => {
  mailFixture.resetMail();
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  t.mock.method(console, 'warn', (...args) => logs.push(args));
  const input = { email: 'stored@example.com', token: 'test-reset-secret', expiresAt: new Date('2026-11-04T12:15:00Z'), pageUrl: 'https://frontend.example.test/reset' };
  assert.deepEqual(await mail.sendPasswordResetEmail(input), { success: true });
  assert.equal(mailFixture.messages[0].to, input.email);
  const link = mailFixture.messages[0].text.split('\n')[1];
  assert.equal(new URL(link).origin, 'https://frontend.example.test');
  assert.equal(new URL(link).searchParams.get('token'), input.token);
  mailFixture.failMail();
  assert.deepEqual(await mail.sendPasswordResetEmail(input), { success: false });
  const key = process.env.SENDGRID_API_KEY;
  delete process.env.SENDGRID_API_KEY;
  try { assert.deepEqual(await mail.sendPasswordResetEmail(input), { success: false }); }
  finally { process.env.SENDGRID_API_KEY = key; }
  assert.deepEqual(logs, []);
  mailFixture.resetMail();
});

test('profile serializers and default projections hide recovery fields; only limiter has TTL', () => {
  const user = new UserModel({ name: 'Person', email: 'person@example.com', passwordResetTokenHash: 'private-hash', passwordResetExpiresAt: new Date() });
  for (const result of [user.toJSON(), user.getPublicProfile()]) {
    assert.equal('passwordResetTokenHash' in result, false);
    assert.equal('passwordResetExpiresAt' in result, false);
  }
  assert.equal(UserModel.schema.path('passwordResetTokenHash').options.select, false);
  assert.equal(UserModel.schema.path('passwordResetExpiresAt').options.select, false);
  assert.equal(UserModel.schema.indexes().some(([, options]) => options.expireAfterSeconds !== undefined), false);
  assert.equal(RecoveryLimitModel.schema.indexes().some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0), true);
});

test('actual auth HTTP route validates and normalizes email, ignores newPassword and passes socket IP', async t => {
  const express = require('express');
  const auth = require('../../src/use-cases/auth.usecase');
  const calls = [];
  t.mock.method(auth, 'forgotPassword', async input => { calls.push(input); return response; });
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', require('../../src/routes/auth.routes'));
  const server = await listen(app);
  t.after(() => server.close());
  const ok = await server.post({ email: ' PERSON@EXAMPLE.COM ', newPassword: 'attacker-password' }, { 'x-forwarded-for': '198.51.100.1' });
  assert.deepEqual(ok, { status: 200, body: { status: 'success', message: MESSAGE } });
  assert.deepEqual(calls, [{ email: 'person@example.com', ip: '127.0.0.1' }]);
  for (const email of ['invalid', '', null, ['person@example.com']]) {
    const result = await server.post({ email });
    assert.equal(result.status, 400);
    assert.equal(result.body.message, 'Validation failed');
    assert.equal(result.body.errors[0].field, 'email');
  }
  assert.equal(calls.length, 1);
});

test('request logger omits URL, path and body secrets', () => {
  const logs = [];
  const spy = mock.method(console, 'log', (...args) => logs.push(args.join(' ')));
  try {
    let finish;
    require('../../src/middlewares/logger.middleware')({ method: 'POST', url: '/reset/raw-secret?token=query-secret', body: { token: 'body-secret' } }, {
      statusCode: 200, on(event, callback) { finish = callback; },
    }, () => {});
    finish();
    assert.equal(logs.length, 2);
    assert.equal(logs.join(' ').includes('secret'), false);
  } finally { spy.mock.restore(); }
});
