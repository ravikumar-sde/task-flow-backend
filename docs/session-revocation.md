# Session versions

Access and refresh JWTs carry `sessionVersion` and an explicit `type`. Missing account versions and legacy JWT versions mean zero. Legacy access tokens without a type remain supported; refresh tokens cannot authenticate protected requests. Authentication checks the current MongoDB account version. Revoked refresh tokens return HTTP 401; optional authentication proceeds anonymously.

`POST /api/v1/auth/reset-password` accepts `{ "token": "<emailed token>", "newPassword": "<new password>" }`. Passwords must be strings of at least six characters, matching the existing password policy. Tokens must contain the 64 hexadecimal characters issued by recovery. Invalid, expired or consumed tokens return HTTP 400. Completion returns only a success message and never signs the user in.

Completion hashes the new password explicitly because query updates do not execute password save hooks. One conditional account update checks the local provider, token hash and expiry, replaces the password hash, removes both reset fields, clears refresh tokens and increments sessionVersion. A missing version increments to one. Success requires exactly one matched account. Persistence errors return a fixed HTTP 500 error without disclosing request or database details. Failed validation and unmatched updates leave account state unchanged.

Signup, login and OAuth session persistence are conditional on the observed version. Login also checks the observed password hash. Refresh checks version and token membership while setting the same version without inserting refresh-token subdocuments. Logout atomically pulls the submitted token. Credentials issued just before reset retain the old version and fail subsequent validation.

The new reset-completion node:test file uses fake configuration and mocked persistence, including actual completion overlapping paused authentication writes. No external service is required. Tests were not executed during this read-only proposal stage; platform verification is required. Real MongoDB atomicity remains an infrastructure-backed verification responsibility.
