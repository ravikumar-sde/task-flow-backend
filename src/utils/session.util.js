const unauthorized = (message = 'Session expired. Please login again.') => Object.assign(new Error(message), { status: 401 });

// Missing fields in existing accounts and JWTs represent the original version.
function sessionVersion(value) {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || value < 0) throw unauthorized();
  return value;
}

function versionFilter(value) {
  const version = sessionVersion(value);
  return version === 0
    ? { $or: [{ sessionVersion: 0 }, { sessionVersion: { $exists: false } }] }
    : { sessionVersion: version };
}

function acceptsAccessToken(decoded, user) {
  return Boolean(user) && (decoded.type === undefined || decoded.type === 'access') &&
    sessionVersion(decoded.sessionVersion) === sessionVersion(user.sessionVersion);
}

module.exports = { unauthorized, sessionVersion, versionFilter, acceptsAccessToken };
