# Password recovery requests

`POST /api/v1/auth/forgot-password` accepts `{ "email": "person@example.com" }`. `newPassword` is ignored; this endpoint never changes passwords or sessions. A valid email always receives HTTP 200:

```json
{"status":"success","message":"If an eligible account exists, a password-reset link will be sent."}
```

Malformed emails receive the existing HTTP 400 `Validation failed` envelope. Only local accounts with an existing nonempty password are eligible. Social accounts, including linked accounts retaining old password hashes, receive no recovery email.

The SendGrid reset-mail adapter is separate from verification mail so recovery cannot enter the verification-code logging fallback. It reads `SENDGRID_API_KEY`, `EMAIL_USER` and optional `EMAIL_FROM_NAME` at runtime. `PASSWORD_RESET_PAGE_URL` must be an absolute HTTPS frontend URL without credentials, query or fragment. It is never derived from a request Host header. The email appends a `token` query parameter. Missing mail settings or reset-page URL suppress delivery and record a fixed failure message. Provider error messages, reset links and raw tokens are never logged by recovery.

`PASSWORD_RESET_EXPIRY_MINUTES` defaults to 15 and accepts only integers from 15 through 30. `PASSWORD_RESET_EMAIL_LIMIT` defaults to 5 and `PASSWORD_RESET_IP_LIMIT` defaults to 20; both must be positive integers. Invalid configured values fail configuration loading. See `.env.example` for placeholders.

Each dimension counts admitted requests within the preceding hour, including unknown and social accounts. Both dimensions are consumed before eligibility lookup, even when the other dimension denies admission. Denied attempts do not extend an occupied sliding-window slot. MongoDB performs atomic updates using its server clock, with a unique `_id` per hashed dimension/key and a TTL cleanup index on the separate RecoveryLimit collection. Cleanup timing is not used to decide admission. Requests fail closed on persistence errors. Ensure application-managed indexes are created before accepting traffic when MongoDB automatic index creation is disabled.

The originating IP is Express `req.ip`. The application keeps Express's default untrusted-proxy setting; arbitrary forwarded headers cannot select a new limit key. A deployment behind a reverse proxy must have a developer configure the precise trusted proxy addresses/hops before using forwarded IPs. Deployment configuration is outside this change.

Each successful issuance atomically replaces the account's active SHA-256 token hash and expiry. Tokens contain 32 cryptographically random bytes. No TTL index is added to users. Profile serialization excludes recovery fields. Concurrent requests may send an already superseded link; only the last persisted hash remains active. Delivery failure removes only that request's hash and cannot remove a concurrent replacement.

This story implements requesting a reset email. A token-redemption endpoint, single-use consumption, the frontend reset page, and session invalidation after successful redemption are separate work; no existing endpoint is changed to accept reset tokens here.

## Verification

Use a Node.js version supported by Mongoose 9 (Node 20.19 or newer). `npm test` runs self-contained node:test assertions with fake configuration, model doubles and mocked SendGrid. It does not load real environment files or contact MongoDB, OpenAI, OAuth providers or SendGrid.

`npm run test:integration` requires a separately provisioned MongoDB server. Set `TEST_MONGODB_URI` to that server; the suite creates a unique disposable database and drops only that database. It fails explicitly if the URI is missing. It never downloads or starts MongoDB and mocks all SendGrid delivery. It exercises actual persistence, HTTP routes, unique/TTL index definitions, separate Mongoose connections, and concurrent limits. Do not use production infrastructure.

The implementation proposal was inspected without executing project code. Tests have not been run in the repository-assistant stage; the platform must run the default suite, and a developer must run the MongoDB suite with its prerequisite available.
