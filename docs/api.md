# API

The web interface talks to the server through a JSON API below `/api`. The OpenID Connect endpoints
for applications (`/.well-known/*`, `/oauth2/*`) are separate and follow the protocol; see
[Connect an application](connect-an-application.md).

## Conventions

- Paths name resources and nest where a resource belongs to another: `/api/users/:id/sessions`.
- `GET` reads, `POST` creates or triggers an action (`/enable`, `/rotate`), `PUT` replaces the editable
  fields of a resource (or creates an assignment), `PATCH` changes individual fields and `DELETE`
  removes or ends something.
- Bodies are JSON. The only exceptions are image uploads to `…/avatar` and `…/logo` (PNG, JPEG or WebP).
- Links in e-mails carry their token in the URL fragment, which browsers never send to a server, and the
  API only receives it in the request body, so tokens don't end up in logs.
- Errors always look like `{ "error": { "code": "not_found", "message": "…", "issues": [] } }`, with
  `issues` only for `validation_failed`. Unknown paths below `/api` return `404 not_found`.
- IDs are snowflakes, sent as strings.

## Authentication and permissions

A browser has one session, shared by the administration and application sign-ins. Paths don't encode
who may call them; every route declares the permission it needs, and the server checks it on each
request: `401 unauthorized` without a session, `403 forbidden` without the permission. A route that
declares nothing doesn't even start. State-changing requests from other origins are rejected.

Roles build on each other:

| Role | Permissions |
| --- | --- |
| `user` | `applications:sign_in` |
| `admin` | everything: `applications:sign_in`, `console:access`, `users:read`, `users:manage`, `applications:read`, `applications:manage`, `sessions:read`, `sessions:manage`, `audit:read`, `settings:read`, `settings:manage` |

`applications:sign_in` is checked during application sign-ins together with the access policy of the
application: `everyone`, or `assigned` for the assigned accounts only. Accounts that manage
applications may always sign in.

## Endpoints

### System

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | public | Health check for containers |
| `GET` | `/api/instance` | public | Instance name, setup state, issuer, version and whether password resets are offered |
| `POST` | `/api/setup` | public, once | Creates the first admin and signs it in |

### Media

Public and cached for good: a new image always gets a new URL.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/media/avatars/:accountId/:hash.webp` | Profile picture, also sent as the `picture` claim |
| `GET` | `/api/media/logos/:applicationId/:hash.webp` | Application logo |

### Authentication

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/auth/session` | signed in | Signed-in account, session and permissions |
| `POST` | `/api/auth/session` | public | Signs in to the administration; requires `console:access`. `201` with the session, or `202` with a second-factor prompt |
| `POST` | `/api/auth/session/second-factor` | public | Confirms the pending second factor and starts the session |
| `DELETE` | `/api/auth/session` | public | Signs out of the administration and all applications |
| `GET` | `/api/auth/requests/:challenge` | public | Pending prompt of an authorization request: sign-in, consent or redirect |
| `POST` | `/api/auth/requests/:challenge/sign-in` | public | Signs in to the application; requires access to it. Answers with a redirect or a second-factor prompt |
| `POST` | `/api/auth/requests/:challenge/second-factor` | public | Confirms the pending second factor and continues the request |
| `POST` | `/api/auth/requests/:challenge/consent` | signed in | Grants the requested scopes |
| `POST` | `/api/auth/requests/:challenge/cancel` | public | Cancels; the application receives `access_denied` |
| `POST` | `/api/auth/password-reset` | public | Sends a reset link if the address belongs to an account; always `202`, whether or not it does |
| `POST` | `/api/auth/password-reset/validate` | public | Checks a reset link and returns the account it belongs to, with a masked address |
| `POST` | `/api/auth/password-reset/confirm` | public | Redeems the link, sets the new password and ends every session of the account |
| `POST` | `/api/auth/email-change/confirm` | public | Redeems the link sent to a new address and applies it |

### Own account and dashboard

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/account` | `console:access` | The own account and an e-mail change waiting for confirmation |
| `PUT` | `/api/account` | `console:access` | Changes the own display name and e-mail address; with an e-mail server, a new address is confirmed from its mailbox first |
| `DELETE` | `/api/account/email-change` | `console:access` | Cancels the pending e-mail change |
| `POST` | `/api/account/email-change/resend` | `console:access` | Sends the confirmation link of the pending change again |
| `POST` | `/api/account/password` | `console:access` | Changes the own password |
| `GET` | `/api/account/two-factor` | `console:access` | Whether two-factor authentication is on and how many recovery codes are left |
| `POST`, `DELETE` | `/api/account/two-factor/setup` | `console:access` | Starts the setup with the password (returns the secret), or discards it |
| `POST` | `/api/account/two-factor` | `console:access` | Confirms the setup with a code and returns the recovery codes |
| `POST` | `/api/account/two-factor/disable` | `console:access` | Turns it off; requires password and code |
| `POST` | `/api/account/two-factor/recovery-codes` | `console:access` | Issues new recovery codes; requires password and code |
| `PUT`, `DELETE` | `/api/account/avatar` | `console:access` | Uploads or removes the own profile picture |
| `GET` | `/api/overview` | `console:access` | Key figures, sign-in activity and recent events |

### Users

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/users` | `users:read` | Lists accounts |
| `POST` | `/api/users` | `users:manage` | Creates an account |
| `GET` | `/api/users/:id` | `users:read` | Reads an account |
| `PUT`, `DELETE` | `/api/users/:id` | `users:manage` | Replaces profile and role, or deletes the account |
| `POST` | `/api/users/:id/enable` | `users:manage` | Enables the account |
| `POST` | `/api/users/:id/disable` | `users:manage` | Disables the account and ends its sessions |
| `POST` | `/api/users/:id/password` | `users:manage` | Sets a generated or chosen password |
| `PUT`, `DELETE` | `/api/users/:id/avatar` | `users:manage` | Uploads or removes the profile picture |
| `DELETE` | `/api/users/:id/two-factor` | `users:manage` | Resets the second factor of another account |
| `GET` | `/api/users/:id/applications` | `applications:read` | Every application, with assignment and whether the account may sign in |
| `GET` | `/api/users/:id/sessions` | `sessions:read` | Sessions of the account |
| `DELETE` | `/api/users/:id/sessions` | `sessions:manage` | Ends all sessions of the account |

### Applications

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/applications` | `applications:read` | Lists applications |
| `POST` | `/api/applications` | `applications:manage` | Creates an application |
| `GET` | `/api/applications/:id` | `applications:read` | Reads an application |
| `PUT`, `DELETE` | `/api/applications/:id` | `applications:manage` | Replaces the settings, including the access policy, or deletes it |
| `POST` | `/api/applications/:id/secret` | `applications:manage` | Rotates the client secret |
| `PUT`, `DELETE` | `/api/applications/:id/logo` | `applications:manage` | Uploads or removes the logo |
| `GET` | `/api/applications/:id/users` | `applications:read` | Accounts assigned to the application |
| `PUT`, `DELETE` | `/api/applications/:id/users/:userId` | `applications:manage` | Assigns an account or removes the assignment |
| `GET` | `/api/applications/:id/sessions` | `sessions:read` | Sessions signed in to the application |
| `DELETE` | `/api/applications/:id/sessions` | `sessions:manage` | Revokes the sign-ins of all sessions |
| `DELETE` | `/api/applications/:id/sessions/:sessionId` | `sessions:manage` | Revokes the sign-in of one session |

### Sessions, audit log and settings

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/sessions` | `sessions:read` | Sessions of all accounts |
| `DELETE` | `/api/sessions/:id` | `sessions:manage` | Ends a session |
| `GET` | `/api/audit/events` | `audit:read` | One page of the audit log |
| `GET` | `/api/audit/summary` | `audit:read` | Totals for the same filters |
| `GET` | `/api/settings` | `settings:read` | Instance settings |
| `PATCH` | `/api/settings` | `settings:manage` | Changes individual instance settings |
| `GET` | `/api/settings/keys` | `settings:read` | Signing keys and password hashing parameters |
| `POST` | `/api/settings/keys/rotate` | `settings:manage` | Rotates the signing key |
| `GET` | `/api/settings/email` | `settings:read` | SMTP settings; the password is never returned |
| `PUT` | `/api/settings/email` | `settings:manage` | Saves the SMTP settings; turning sending on verifies the connection first |
| `POST` | `/api/settings/email/test` | `settings:manage` | Tests the entered settings without saving them, or sends a test message to the own address |

## Code layout

The server mounts the API once at `/api` (`API_PREFIX` in `@aegis/contracts`). Below that, the folders in
`apps/server/src/http/api` mirror the paths: every file is a Fastify plugin that registers its routes
relative to its own prefix and mounts the plugins nested below it.

```text
apps/server/src/http
├── app.ts               three areas: /api, the OIDC protocol, the web interface
├── access.ts            session of a request, access(...) declarations, authorization
├── oidc.ts              /.well-known/*, /oauth2/*
├── web.ts               everything else, proxied to Next.js; pages require console:access
└── api
    ├── index.ts         /api: deny by default, CSRF check, response headers, 404 for unknown paths
    ├── system.ts        /health, /instance, /setup
    ├── media.ts         /media
    ├── auth/            /auth: session.ts, requests.ts, sign-in.ts (steps both share), recovery.ts
    ├── account.ts       /account
    ├── overview.ts      /overview
    ├── users/           /users: index.ts, user.ts (/:id)
    ├── applications/    /applications: index.ts, application.ts (/:id), users.ts, sessions.ts
    ├── sessions.ts      /sessions
    ├── audit.ts         /audit
    └── settings/        /settings: index.ts, keys.ts, email.ts
```

A route states who may call it next to its path, for example
`app.post("/", access("users:manage", rateLimits.sensitive), handler)`. Roles and their permissions are
defined in `packages/contracts/src/roles.ts`; who may sign in to which application is decided by
`ApplicationAccess` in `apps/server/src/services/application-access.ts`.

In the web interface, `api` and `useApiQuery` from `apps/web/src/lib/api.ts` and
`apps/web/src/hooks/use-api-query.ts` add the prefix, so calls use paths like `api.get("/users")`.
