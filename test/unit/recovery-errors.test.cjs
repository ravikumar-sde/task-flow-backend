const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
require('../helpers/bootstrap.cjs');
const app = require('../../src/app');
const config = require('../../src/config/server');
const auth = require('../../src/use-cases/auth.usecase');

function post(server, path, data) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port: server.address().port,
      path,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(data),
      },
    }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', part => { text += part; });
      response.on('error', reject);
      response.on('end', () => {
        try { resolve({ status: response.statusCode, body: JSON.parse(text) }); }
        catch (error) { reject(error); }
      });
    });
    request.on('error', reject);
    request.end(data);
  });
}

// Uses the actual application so JSON parsing and the final error handler are
// exercised together. The bootstrap supplies fake configuration and mail.
// This proposal has not executed tests; platform verification is required.
test('application sanitizes malformed JSON for every accepted recovery URL variant', async t => {
  const logs = [];
  for (const method of ['error', 'warn', 'log']) {
    t.mock.method(console, method, (...args) => logs.push(args));
  }
  const recovery = t.mock.method(auth, 'forgotPassword', async () => ({ message: 'test recovery response' }));
  const originalEnv = config.env;
  config.env = 'development';
  t.after(() => { config.env = originalEnv; });

  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));

  const token = 'submitted-recovery-secret';
  const resetUrl = `https://frontend.example.test/reset?token=${token}`;
  const malformed = `{"token":"${token}","resetUrl":"${resetUrl}",}`;
  const paths = [
    '/api/v1/auth/forgot-password',
    '/api/v1/auth/forgot-password/',
    '/API/V1/AUTH/FORGOT-PASSWORD',
    '/Api/V1/Auth/Forgot-Password/',
  ];

  for (const path of paths) {
    await t.test(path, async () => {
      // First prove that this variant reaches the actual recovery route.
      assert.deepEqual(await post(server, path, JSON.stringify({ email: 'person@example.com' })), {
        status: 200,
        body: { status: 'success', message: 'test recovery response' },
      });
      const callsBefore = recovery.mock.callCount();
      logs.length = 0;
      const result = await post(server, `${path}?token=${token}`, malformed);
      assert.deepEqual(result, {
        status: 400,
        body: { status: 'error', message: 'Unable to process request' },
      });
      assert.equal(recovery.mock.callCount(), callsBefore);
      assert.deepEqual(logs, [['Password reset request error']]);
      const output = JSON.stringify({ result, logs });
      assert.equal(output.includes(token), false);
      assert.equal(output.includes(resetUrl), false);
      assert.equal(output.includes('stack'), false);
    });
  }
});
