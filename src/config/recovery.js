function integer(env, name, fallback, min, max = Number.MAX_SAFE_INTEGER) {
  const raw = env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`Invalid ${name} configuration`);
  }
  return value;
}

function readRecoveryConfig(env = process.env) {
  const expiryMinutes = integer(env, 'PASSWORD_RESET_EXPIRY_MINUTES', 15, 15, 30);
  const emailLimit = integer(env, 'PASSWORD_RESET_EMAIL_LIMIT', 5, 1);
  const ipLimit = integer(env, 'PASSWORD_RESET_IP_LIMIT', 20, 1);
  let pageUrl = null;
  if (env.PASSWORD_RESET_PAGE_URL !== undefined) {
    try {
      const url = new URL(env.PASSWORD_RESET_PAGE_URL);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
        throw new Error();
      }
      pageUrl = url.href;
    } catch {
      throw new Error('Invalid PASSWORD_RESET_PAGE_URL configuration');
    }
  }
  return Object.freeze({ expiryMinutes, emailLimit, ipLimit, pageUrl });
}

module.exports = { readRecoveryConfig };
