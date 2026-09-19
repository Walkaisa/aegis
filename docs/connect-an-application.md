# Connect an application

## Register the application

1. In Aegis, open **Applications** and choose **New application**.
2. Pick the type:
   - **Web application** for apps with a server that can keep a secret. It gets a client secret.
   - **Single-page app** and **Native & CLI** for apps that run in the browser or on a device. They
     don't get a secret.
3. Enter the redirect URI of your application exactly, for example
   `https://app.example.com/api/auth/callback/aegis`.
4. Copy the client ID and the client secret. The secret is only shown once, but you can rotate it
   later.

Trusted web applications can skip the consent screen. Users then go straight back to the app after
signing in and see the requested permissions on the sign-in page instead.

## PKCE

Every application has a PKCE policy under **Settings → Security**, which can be changed at any time:

| Policy | Authorization request without `code_challenge` | Available for |
| --- | --- | --- |
| Required | Rejected with `invalid_request` | All applications; the only choice for single-page and native apps |
| Optional | Accepted | Web applications (default) |
| Disabled | Accepted | Web applications |

Only `S256` is supported; `plain` is always rejected. Whenever an application does send a
`code_challenge`, the matching `code_verifier` is required at the token endpoint, whatever the policy.
Web applications still authenticate with their client secret, so apps without PKCE support, such as
Gitea, work with **Optional**. Prefer **Required** for every app that supports PKCE.

## Settings for your application

| Setting | Value |
| --- | --- |
| Issuer | `https://auth.example.com` |
| Discovery | `https://auth.example.com/.well-known/openid-configuration` |
| Flow | Authorization Code |
| PKCE | S256; required for public clients, configurable for web applications |
| Scopes | `openid profile email` |
| Client authentication | `client_secret_basic` or `client_secret_post` |

## Claims

| Scope | Claims |
| --- | --- |
| `openid` | `sub` |
| `profile` | `name`, `picture`, `updated_at` |
| `email` | `email`, `email_verified` |

Claims are included in the ID token and returned by the UserInfo endpoint.

- `sub` is the account ID and never changes, even when the email address does.
- `picture` is a public URL of the profile picture. A new picture gets a new URL, so it can be cached
  forever. The claim is left out while an account has no picture.

## Two-factor authentication

Accounts can protect their sign-in with a code from an authenticator app. Applications don't have to do
anything for that, but they can see and demand it:

- `amr` in the ID token lists how the user authenticated: `["pwd"]` with the password alone,
  `["pwd", "otp", "mfa"]` with a code from the app, `["pwd", "mfa"]` with a recovery code.
- `acr` is `urn:aegis:acr:mfa` when a second factor was used and `urn:aegis:acr:password` otherwise.
- Sending `acr_values=urn:aegis:acr:mfa` with the authorization request asks for a second factor. A user
  who is already signed in with the password only is asked for the code before returning to the
  application. Accounts without a second factor sign in as usual, and the ID token then says so through
  `amr` and `acr` — check the claim if your application must insist on it.

## Auth.js

```ts
import NextAuth from "next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [{ id: "aegis", name: "Aegis", type: "oidc" }],
});
```

```dotenv
AUTH_SECRET=...  # openssl rand -base64 32
AUTH_AEGIS_ISSUER=https://auth.example.com
AUTH_AEGIS_ID=<client id>
AUTH_AEGIS_SECRET=<client secret>
```

Redirect URI: `https://app.example.com/api/auth/callback/aegis`

Auth.js uses PKCE, `state` and the scopes `openid profile email` by default. The profile picture is
available as `session.user.image`.

## oauth2-proxy

For applications without their own login, put oauth2-proxy in front of them:

```bash
oauth2-proxy \
  --provider=oidc \
  --oidc-issuer-url=https://auth.example.com \
  --client-id=<client id> \
  --client-secret=<client secret> \
  --code-challenge-method=S256 \
  --redirect-url=https://app.example.com/oauth2/callback \
  --email-domain=* \
  --cookie-secret=<openssl rand -base64 32 | head -c 32>
```

## Signing out

To sign a user out from your application, redirect to the `end_session_endpoint` from the discovery
document with `id_token_hint` and a registered `post_logout_redirect_uri`.
