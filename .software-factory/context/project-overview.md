# Project overview

## Purpose

Task Flow is the REST API backend for a Trello-style task management app. Users
organise work into **workspaces**. A workspace holds **boards**, a board holds
ordered **stages** (columns), and a stage holds ordered **cards** (tasks) that
can carry **comments**. An AI endpoint turns a natural-language prompt into a
structured "card action" JSON that a client can then run.

The API is consumed by a separate frontend. The default `FRONTEND_URL` is
`http://localhost:5173`, which points to a Vite dev server; see
`src/controllers/auth.controller.js`. The npm package is still named
`trellobackend`, but the product name is "Task Flow".

## Users and roles

- **Authenticated user**: anyone who signs up with email and password, or with
  Google or GitHub OAuth. Every domain endpoint requires a JWT bearer token.
- **Workspace roles**, stored per membership in `WorkspaceMember.role` (see
  `src/database/models/WorkspaceMemberModel.js`):

  | Capability | admin | member | viewer |
  |---|---|---|---|
  | View the workspace, boards, stages and cards; comment | ✓ | ✓ | ✓ |
  | Create and edit boards, stages and cards; move cards; reorder stages; archive boards | ✓ | ✓ | – |
  | Delete boards, stages and cards | ✓ | – | – |
  | Generate invite codes; remove members; change roles; edit workspace settings | ✓ | – | – |

- **Workspace owner** (`Workspace.ownerId`): the creator, who is made an admin
  automatically. Only the owner can delete the workspace. The owner cannot be
  removed and their role cannot be changed.
- **Comment author**: only the author can edit or delete their own comment.

## Tech stack and architecture

- Node.js with Express 5 and MongoDB through Mongoose 9. The code is CommonJS
  with no build step. Entry points are `src/server.js` and `src/app.js`.
- The code is layered in a "clean architecture" style, as described in
  `README.md`:
  - `src/routes/*.routes.js`: route definitions and `express-validator` rules.
  - `src/controllers/*.controller.js`: HTTP mapping. Errors thrown by use cases
    become 400 or 404 responses with `{ status: 'error', message }`.
  - `src/use-cases/*.usecase.js`: business logic and permission checks.
    Classes are exported as singletons.
  - `src/entities/*.js`: plain domain objects with `validate()` rules.
  - `src/database/models/*Model.js`: Mongoose schemas, indexes and
    `toSafeObject()` serialisers.
  - `src/services/`: external integrations, namely OpenAI and SendGrid.
- Authentication uses JWTs created with `jsonwebtoken`, verified in
  `src/middlewares/auth.middleware.js`, plus Passport strategies for Google and
  GitHub in `src/config/passport.js`. Passport runs stateless with
  `session: false`.
- The AI client is the `openai` SDK. The model, temperature and token limit are
  set from the environment, with `gpt-4o-mini` as the default model; see
  `src/config/openai.js`.
- Responses use the envelope `{ status: 'success' | 'error', message, data? }`.
  Validation failures return 400 with an `errors: [{ field, message }]` array;
  see `src/middlewares/validation.middleware.js`.

## Data model

All collections have `createdAt` and `updatedAt` timestamps. Models live in
`src/database/models/`.

- **User**: name, unique email, password (bcrypt-hashed in a pre-save hook and
  excluded from queries by default), `authProvider` (`local`, `google`,
  `github` or `facebook`), `providerId`, avatar, and a `refreshTokens[]` array.
- **Workspace**: name, description, `ownerId`, `isPrivate` (default true), and
  an optional 12-character alphanumeric `inviteCode` with `inviteCodeExpiry`.
- **WorkspaceMember**: a join of `workspaceId` and `userId` (unique together),
  plus `role` and `joinedAt`.
- **Board**: name, description, `workspaceId`, `createdBy`, `backgroundColor`
  (a hex value, default `#0079BF`), `isFavorite` and `isArchived`.
- **Stage**: name, `boardId` and a zero-based `position`.
- **Card**: title, description, `stageId`, `boardId` (denormalised),
  zero-based `position` within its stage, `assignedTo[]` (user ids), `dueDate`,
  `priority` (`low`, `medium`, `high` or `urgent`; default `medium`),
  `labels[]` (free-text strings) and `createdBy`.
- **Comment**: content of up to 2000 characters, `cardId` and `userId`.

## Implemented business flows

All routes are mounted under `/api/v1` in `src/app.js`. `GET /health` is a
public liveness check. A Postman collection covering the API is in
`Task_flow_Backend.postman_collection.json`.

1. **Local auth** (`src/use-cases/auth.usecase.js`)
   - Signup logs the user in immediately; email verification was removed in
     commit `959ebc5`.
   - Login returns an access token (`JWT_EXPIRE`, default 7 days) and a
     refresh token (30 days, stored on the user).
   - `POST /auth/refresh` issues a new access token. Logout removes the given
     refresh token.
   - `GET /auth/me` returns the profile and `PUT /auth/profile` updates name
     and avatar.
   - `POST /auth/change-password` requires the current password.
2. **OAuth** (`src/config/passport.js`, `src/controllers/auth.controller.js`)
   - `GET /auth/google` and `GET /auth/github` start the provider flow.
   - The callback finds the user by provider id, or else links to an existing
     account by email, or else creates a new user.
   - The callback then redirects to `${FRONTEND_URL}/auth/callback` with
     `token` and `refreshToken` in the query string. The strategies are only
     registered when their client id and secret are set.
3. **Workspaces and membership** (`src/use-cases/workspace.usecase.js`)
   - Covers CRUD and listing "my workspaces", with the caller's `memberRole`
     on each.
   - An admin generates an invite code that expires after 1 to 365 days
     (default 7).
   - Users join with `POST /workspaces/join/:inviteCode` or
     `POST /workspaces/join-with-code` (manual code entry, added in `60e399b`).
     Joiners get the `member` role.
   - Admins can list members, remove members and change member roles.
4. **Boards** (`src/use-cases/board.usecase.js`)
   - Covers create, read, update and delete, archive and unarchive, toggling
     favourite, listing a workspace's boards (with `?includeArchived=true`),
     and listing favourites across all of the user's workspaces.
   - `GET /workspaces/:id/board/:boardId` is the **board dashboard**: one call
     that returns the board, its stages with their cards (populated with
     creator and assignees), and the caller's role.
5. **Stages** (`src/use-cases/stage.usecase.js`)
   - A new stage is appended at the end of its board.
   - Stages can be renamed. Bulk reorder takes `{ stageOrders: [{ stageId,
     position }] }`.
   - Deleting a stage also deletes its cards and closes the gap in positions.
6. **Cards** (`src/use-cases/card.usecase.js`)
   - A new card is appended at the end of its stage.
   - A card can be moved within its stage or to another stage on the same
     board. The positions of neighbouring cards are shifted to match.
   - Cards can be listed per stage or per board.
   - Cards can be filtered with `?members=`, `?labels=` and
     `?dueDate=overdue|today|tomorrow`, and searched with `?q=` (a
     case-insensitive regex on title and description).
7. **Comments** (`src/use-cases/comment.usecase.js`): create and list
   (newest first) for workspace members; edit and delete for the author only.
8. **AI prompt parsing** (`src/services/openai.service.js`,
   `src/routes/ai.routes.js`)
   - `POST /ai/parse-prompt` takes a prompt of 10 to 1000 characters and uses
     JSON mode to return `{ action, workspace, board, list, card: { title,
     description, priority, deadline } }`.
   - `action` is one of `create_card`, `update_card`, `move_card` or
     `delete_card`.
   - The endpoint **only parses**. It does not resolve names to ids and does
     not create or change any data. The client must act on the result.
   - `GET /ai/health` reports whether an API key is configured.

## Terminology

- **Stage** is the same thing as a "list" or "column". The AI prompt and its
  output say `list`, while the API and database say `stage`.
- **Card** is the same thing as a "task". The message returned when a stage is
  deleted says "tasks".
- **Deadline** in the AI output corresponds to `dueDate` on a card.
- **Invite code** is the 12-character code on a workspace. "Invite link" in
  route names means the same code.
- **Dashboard** means the aggregated board view with stages and cards, not an
  analytics page.

## Important constraints and rules

- Every board, stage, card and comment operation checks that the caller is a
  member of the owning workspace, found through card → board → workspace.
  Viewers are read-only except for comments.
- Positions are contiguous zero-based integers that the server maintains.
  Clients send a target position but must not assume gaps.
- An OAuth account cannot log in with a password, and its password cannot be
  reset or changed.
- A card can only be moved to a stage on the same board.
- CORS origins come from `CORS_ORIGIN`, which accepts `*`, a single origin or
  a comma-separated list; see `src/config/server.js`.
- Configuration comes only from environment variables. `.env.example` lists
  them: MongoDB URI, JWT secret, OAuth client settings, `FRONTEND_URL`,
  SendGrid settings and OpenAI settings.
- Deployment targets are Render (`render.yaml`, free plan, health check at
  `/health`) and Vercel (`vercel.json`, `@vercel/node`).
- CI runs on GitHub Actions in `.github/workflows/`, using Node 18 for the app
  workflows.

## Known gaps and risks

- **Unauthenticated password reset.** `POST /auth/forgot-password` sets a new
  password for any local account given only its email address. There is no
  token and no email step; see `auth.usecase.js` `forgotPassword`.
- **Unprotected user CRUD.** `/api/v1/users` (`src/routes/user.routes.js`) has
  no `authenticate` middleware. Anyone can list, update or delete users.
- **OAuth account takeover by email.** OAuth login links to any existing
  account with the same email and overwrites its `authProvider`. After that,
  the original local user can no longer log in with a password.
- **Tokens in the URL.** The OAuth callback puts the access and refresh tokens
  in a redirect query string, and the server logs that URL.
- **Favourites are shared.** `Board.isFavorite` is a single flag on the board,
  so favouriting a board does it for every member, not just the caller.
- **Incomplete cascade deletes.**
  - Deleting a workspace removes its members and the workspace only. Its
    boards, stages, cards and comments are left orphaned (there is a TODO in
    `workspace.usecase.js`).
  - Deleting a board leaves its stages and cards in place.
  - Deleting a card or a stage leaves its comments in place.
- **No transactions.** Position shifts in card moves and stage deletes are
  several separate writes, so concurrent moves can produce duplicate or
  missing positions. Stage reorder does not check that the stage ids belong to
  the board.
- **Unescaped search.** Card search passes the user's input straight into a
  MongoDB `$regex`, which allows regex injection or ReDoS.
- **Configuration drift.**
  - `.env.example` and `render.yaml` define `JWT_EXPIRES_IN`,
    `JWT_REFRESH_SECRET` and `JWT_REFRESH_EXPIRES_IN`, but the code reads
    `JWT_EXPIRE` and signs refresh tokens with `JWT_SECRET`.
  - `render.yaml` sets SMTP variables, but `email.service.js` uses SendGrid.
  - `CORS_ORIGIN` and the `OPENAI_*` variables are missing from
    `render.yaml`.
- **Dead or unused code.**
  - `src/services/email.service.js` is only used by `test-email.js`.
  - `src/middlewares/logger.middleware.js`, `src/utils/response.util.js` and
    `optionalAuth` are not wired in.
  - `nodemailer` is a dependency but is not used.
  - Passport sets `isEmailVerified`, which is not a field in the schema, so
    Mongoose drops it.
- **No tests, linting or formatting.** The `test`, `lint` and `format` scripts
  in `package.json` are placeholders that exit 0, so the CI jobs pass without
  checking anything.
- **No pagination or rate limiting** on any list endpoint, or on the
  authentication and AI endpoints.
- **Error status codes.** Use-case errors are plain `Error` objects, so
  permission failures return 400 instead of 403.
