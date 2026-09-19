# Security

## Protocol

- Only the Authorization Code flow is available. PKCE supports S256 only and is always required for
  public clients, which have no secret. Web applications authenticate with their client secret and set
  PKCE per application to required, optional (default) or disabled; a `code_challenge` that was sent is
  always verified.
- There are no implicit, password, client credentials or device flows, no dynamic client
  registration and no refresh tokens.
- Redirect URIs are compared exactly. Wildcards and fragments are rejected, HTTP is only allowed for
  `localhost` and custom URI schemes only for public clients.

## Secrets

- Passwords are hashed with Argon2id and never trimmed or normalized.
- TOTP secrets are stored encrypted with AES-256-GCM and bound to their account; recovery codes are
  only kept as SHA-256 hashes.
- Signing keys (RS256), cookie keys and client secrets are stored encrypted with AES-256-GCM. The key
  only exists in the environment, and Aegis checks on startup that it matches the instance.
- Client secrets are shown once after creating or rotating them.

## Accounts and sessions

- Roles are hierarchical: users only sign in to applications, administrators also manage Aegis. Every
  API route declares the permission it requires, and the server checks it on each request; a route
  without a declaration doesn't start.
- Applications can be restricted to assigned accounts. Taking access away ends the affected sign-ins
  and revokes their tokens immediately.
- Signing out, ending a session, disabling an account or changing a password ends single sign-on
  immediately.
- Two-factor authentication (TOTP) protects the sign-in of an account everywhere: the correct password
  alone only yields a short-lived, encrypted challenge cookie, never a session. Each code is accepted
  once, five wrong codes end the attempt, and wrong codes count towards the same throttle as wrong
  passwords. Recovery codes work once each. Turning it on ends the account's other sessions.
- Uploaded images are decoded and re-encoded, so only pixel data is ever stored.

## HTTP

- Rate limiting per IP address for sign-ins and other sensitive endpoints.
- CSRF protection through origin checks and `SameSite` cookies.
- A strict, nonce-based Content Security Policy for all pages.

## Reporting a vulnerability

Please don't open a public issue for security problems. Contact the maintainer privately instead.
