const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fixture = require('../helpers/bootstrap.cjs');
const mongoose = require('mongoose');
const express = require('express');
const User = require('../../src/database/models/UserModel');
const Limit = require('../../src/database/models/RecoveryLimitModel');
const { PasswordRecoveryUseCase, MESSAGE, hashToken } = require('../../src/use-cases/password-recovery.usecase');
const { readRecoveryConfig } = require('../../src/config/recovery');
const { listen } = require('../helpers/http.cjs');
const auth = require('../../src/use-cases/auth.usecase');
const router = require('../../src/routes/auth.routes');
const expected = { status: 200, body: { status: 'success', message: MESSAGE } };

function tokenFrom(message) {
  return new URL(message.text.split('\n')[1]).searchParams.get('token');
}

// This suite deliberately fails rather than silently skipping without MongoDB.
// It is separate from npm test because unique-index/atomicity assertions need
// real infrastructure and must not be replaced by in-memory model doubles.
test('MongoDB recovery persistence and HTTP integration', { timeout: 120000 }, async t => {
  assert.ok(process.env.TEST_MONGODB_URI, 'TEST_MONGODB_URI is required for test:integration');
  const dbName = `recovery_test_${randomUUID().replaceAll('-', '')}`;
  const connections = [];
  const servers = [];
  const settings = readRecoveryConfig(process.env);
  const logs = [];
  t.mock.method(console, 'warn', message => logs.push(message));
  t.mock.method(console, 'error', message => logs.push(message));
  t.after(async () => {
    for (const server of servers) await server.close();
    if (connections[0]?.readyState === 1) await connections[0].dropDatabase();
    await Promise.all(connections.map(connection => connection.close()));
  });

  for (let i = 0; i < 2; i++) {
    const connection = mongoose.createConnection(process.env.TEST_MONGODB_URI, {
      dbName, serverSelectionTimeoutMS: 5000,
    });
    connections.push(connection);
    await connection.asPromise();
  }
  const models = connections.map(connection => ({
    users: connection.model('User', User.schema),
    limits: connection.model('RecoveryLimit', Limit.schema),
  }));
  await models[0].users.init();
  await models[0].limits.init();
  const services = models.map(model => new PasswordRecoveryUseCase({ ...model, settings,
    clock: () => new Date('2026-11-04T12:00:00Z'),
  }));
  const U = models[0].users;
  const L = models[0].limits;
  // Dispatch each actual controller call to the service belonging to the
  // receiving application; each service has its own MongoDB connection.
  let nextService = services[0];
  t.mock.method(auth, 'forgotPassword', input => nextService.request(input));
  // Avoid a shared dispatch pointer during concurrent requests by selecting
  // the service synchronously in each application's controller invocation.
  for (const service of services) {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { nextService = service; next(); });
    app.use('/api/v1/auth', router);
    // express-validator is asynchronous, so use a per-request binding below.
    servers.push(await listen(app));
  }
  // Use AsyncLocalStorage so concurrent validator execution keeps the service
  // associated with its application rather than relying on request ordering.
  const { AsyncLocalStorage } = require('node:async_hooks');
  const context = new AsyncLocalStorage();
  for (const server of servers.splice(0)) await server.close();
  for (const service of services) {
    const app = express();
    app.use((req, res, next) => context.run(service, next));
    app.use(express.json());
    app.use('/api/v1/auth', router);
    servers.push(await listen(app));
  }
  auth.forgotPassword = input => context.getStore().request(input);

  async function clear() {
    await U.deleteMany({});
    await L.deleteMany({});
    fixture.resetMail();
    logs.length = 0;
  }
  async function local(email = 'person@example.com') {
    return U.create({ name: 'Person', email, password: 'original-password', authProvider: 'local' });
  }
  async function account(id) {
    return U.findById(id).select('+password +passwordResetTokenHash +passwordResetExpiresAt');
  }

  await t.test('uniform outcomes, hash persistence, default expiry, stored recipient and replacement', async () => {
    await clear();
    const user = await local();
    const before = (await account(user._id)).password;
    assert.deepEqual(await servers[0].post({ email: ' PERSON@EXAMPLE.COM ', newPassword: 'attack-password' }), expected);
    const first = tokenFrom(fixture.messages[0]);
    let saved = await account(user._id);
    assert.equal(saved.password, before);
    assert.equal(fixture.messages[0].to, user.email);
    assert.equal(saved.passwordResetTokenHash, hashToken(first));
    assert.equal(saved.passwordResetExpiresAt.toISOString(), '2026-11-04T12:15:00.000Z');
    assert.equal(JSON.stringify(await U.collection.findOne({ _id: user._id })).includes(first), false);
    assert.deepEqual(await servers[1].post({ email: user.email }), expected);
    saved = await account(user._id);
    assert.notEqual(saved.passwordResetTokenHash, hashToken(first));
    assert.equal(saved.passwordResetTokenHash, hashToken(tokenFrom(fixture.messages[1])));
    assert.equal(saved.password, before);
    assert.equal((await U.findById(user._id)).passwordResetTokenHash, undefined);
    for (const publicValue of [saved.toJSON(), saved.getPublicProfile()]) {
      assert.equal('passwordResetTokenHash' in publicValue, false);
      assert.equal('passwordResetExpiresAt' in publicValue, false);
    }
    assert.deepEqual(await servers[0].post({ email: 'unknown@example.com' }), expected);
    assert.equal(fixture.messages.length, 2);
    assert.equal((await servers[0].post({ email: 'bad' })).status, 400);
  });

  await t.test('passwordless local and social accounts including retained hashes are ineligible', async () => {
    await clear();
    const accounts = await U.create([
      { name: 'No Password', email: 'empty@example.com', authProvider: 'local' },
      ...['google', 'github', 'facebook'].map(authProvider => ({
        name: 'Linked User', email: `${authProvider}@example.com`, authProvider, password: 'retained-password',
      })),
    ]);
    for (const user of accounts) {
      const before = await account(user._id);
      assert.deepEqual(await servers[0].post({ email: user.email, newPassword: 'attack-password' }), expected);
      const after = await account(user._id);
      assert.equal(after.password, before.password);
      assert.equal(after.passwordResetTokenHash, undefined);
    }
    assert.equal(fixture.messages.length, 0);
  });

  await t.test('delivery failures and absent configuration are uniform and sanitized', async () => {
    await clear();
    const user = await local();
    const password = (await account(user._id)).password;
    fixture.failMail();
    assert.deepEqual(await servers[0].post({ email: user.email }), expected);
    assert.equal((await account(user._id)).passwordResetTokenHash, undefined);
    const key = process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_API_KEY;
    try { assert.deepEqual(await servers[1].post({ email: user.email }), expected); }
    finally { process.env.SENDGRID_API_KEY = key; }
    assert.equal((await account(user._id)).password, password);
    assert.equal(fixture.messages.length, 0);
    assert.deepEqual(logs, ['Password reset delivery failed', 'Password reset delivery failed']);
  });

  await t.test('concurrent per-email limit across applications leaves exactly one active hash', async () => {
    await clear();
    const user = await local();
    const password = (await account(user._id)).password;
    const results = await Promise.all(Array.from({ length: 16 }, (_, i) => servers[i % 2].post({
      email: i % 2 ? ' PERSON@EXAMPLE.COM ' : user.email,
    })));
    results.forEach(result => assert.deepEqual(result, expected));
    assert.equal(fixture.messages.length, 5);
    const saved = await account(user._id);
    assert.equal(saved.password, password);
    assert.equal(fixture.messages.filter(message => hashToken(tokenFrom(message)) === saved.passwordResetTokenHash).length, 1);
    assert.deepEqual(await servers[1].post({ email: user.email }), expected);
    assert.equal(fixture.messages.length, 5);
  });

  await t.test('concurrent per-IP limit across applications ignores spoofed forwarding headers', async () => {
    await clear();
    const users = await Promise.all(Array.from({ length: 32 }, (_, i) => local(`person${i}@example.com`)));
    const results = await Promise.all(users.map((user, i) => servers[i % 2].post({ email: user.email }, {
      'x-forwarded-for': `198.51.100.${i + 1}`,
    })));
    results.forEach(result => assert.deepEqual(result, expected));
    assert.equal(fixture.messages.length, 20);
    assert.equal(await U.countDocuments({ passwordResetTokenHash: { $exists: true } }), 20);
  });

  await t.test('atomic sliding-hour admission, exact expiry boundary and unique/cleanup indexes', async () => {
    await clear();
    const indexes = await L.collection.indexes();
    assert.ok(indexes.some(index => index.key._id === 1));
    assert.ok(indexes.some(index => index.key.expiresAt === 1 && index.expireAfterSeconds === 0));
    assert.equal((await U.collection.indexes()).some(index => index.expireAfterSeconds !== undefined), false);
    // Dates in the future avoid the background TTL monitor deleting fixtures.
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const admitted = await Promise.all(Array.from({ length: 20 }, (_, i) => models[i % 2].limits.consume('email', 'window@example.com', 5, start)));
    assert.equal(admitted.filter(Boolean).length, 5);
    assert.equal(await L.countDocuments({}), 1);
    assert.equal(await L.consume('email', 'window@example.com', 5, new Date(start.getTime() + 3599999)), false);
    assert.equal(await L.consume('email', 'window@example.com', 5, new Date(start.getTime() + 3600000)), true);
    const record = await L.findOne({});
    assert.equal(record.attempts.length, 1);
    assert.equal(record._id.includes('window@example.com'), false);
  });

  await t.test('configured expiry endpoints are honored', async () => {
    for (const minutes of [15, 30]) {
      await clear();
      const user = await local();
      const service = new PasswordRecoveryUseCase({ ...models[0],
        settings: readRecoveryConfig({ PASSWORD_RESET_EXPIRY_MINUTES: String(minutes), PASSWORD_RESET_PAGE_URL: settings.pageUrl }),
        clock: () => new Date('2026-11-04T12:00:00Z'),
      });
      assert.deepEqual(await service.request({ email: user.email, ip: 'test-ip' }), { message: MESSAGE });
      assert.equal((await account(user._id)).passwordResetExpiresAt.getTime(), new Date('2026-11-04T12:00:00Z').getTime() + minutes * 60000);
    }
    for (const value of ['14', '31']) assert.throws(() => readRecoveryConfig({ PASSWORD_RESET_EXPIRY_MINUTES: value }));
  });
});
