// Test-owned values only. Never load the checkout's real .env file.
const dotenvPath = require.resolve('dotenv');
require.cache[dotenvPath] = {
  id: dotenvPath, filename: dotenvPath, loaded: true,
  exports: { config: () => ({ parsed: {} }) },
};
Object.assign(process.env, {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-only-jwt-secret',
  OPENAI_API_KEY: 'test-only-openai-key',
  SENDGRID_API_KEY: 'SG.test-only-key',
  EMAIL_USER: 'sender@example.test',
  PASSWORD_RESET_PAGE_URL: 'https://frontend.example.test/reset-password',
  PASSWORD_RESET_EXPIRY_MINUTES: '15',
  PASSWORD_RESET_EMAIL_LIMIT: '5',
  PASSWORD_RESET_IP_LIMIT: '20',
});
for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET']) {
  delete process.env[key];
}

const sgMail = require('@sendgrid/mail');
const messages = [];
let failure = false;
sgMail.setApiKey = () => {};
sgMail.send = async message => {
  if (failure) throw new Error(`provider echoed secret payload: ${message.text}`);
  messages.push(message);
  return [{ statusCode: 202, headers: { 'x-message-id': 'test-message' } }];
};

module.exports = {
  messages,
  resetMail() { messages.length = 0; failure = false; },
  failMail(value = true) { failure = value; },
};
