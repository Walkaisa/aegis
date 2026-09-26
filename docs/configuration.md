# Configuration

Aegis is configured with environment variables. A commented template is in
[`.env.example`](../.env.example).

## Required

| Variable | Description |
| --- | --- |
| `AEGIS_ISSUER` | Public URL of Aegis, origin only, for example `https://auth.example.com`. Must use `https` in production, except for `localhost`. |
| `AEGIS_ENCRYPTION_KEY` | 32 bytes as base64 or hex (`openssl rand -base64 32`). Encrypts signing keys, cookie keys, client secrets and the SMTP password. Never change or lose it. |
| `AEGIS_DATABASE_URL` | PostgreSQL connection URL. |

## Optional

| Variable | Default | Description |
| --- | --- | --- |
| `AEGIS_HOST` | `0.0.0.0` | Address Aegis listens on. |
| `AEGIS_PORT` | `3000` | Port Aegis listens on. |
| `AEGIS_TRUST_PROXY` | `false` | `true`, the number of proxy hops or a comma-separated list of IP ranges. |
| `AEGIS_LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`. |
| `AEGIS_ARGON2_MEMORY_KIB` | `65536` | Argon2id memory in KiB. |
| `AEGIS_ARGON2_ITERATIONS` | `3` | Argon2id iterations. |
| `AEGIS_ARGON2_PARALLELISM` | `4` | Argon2id parallelism. |
| `AEGIS_AUDIT_RETENTION_DAYS` | `180` | Initial retention of audit log entries. |
| `AEGIS_UPDATE_CHECK` | `true` | Look for new releases on GitHub every ten minutes and show them to admins. Set to `false` for instances without internet access. |

## Settings in the interface

Some settings live in the database and can be changed by administrators at any time:

- **Instance name** and **session lifetime** (30 days by default) under Settings.
- **Audit log retention** directly on the audit log page.
- **E-mail server** (SMTP) under Settings → Email. Aegis uses it for password resets, confirmations of new
  e-mail addresses and notifications about password changes. Without it, these features stay hidden.
