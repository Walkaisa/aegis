# Installation

Aegis runs as a single container next to PostgreSQL. Database migrations run automatically when
the container starts, so an empty database is all you need.

## Docker Compose

Create a `compose.yaml`:

```yaml
services:
  aegis:
    image: ghcr.io/walkaisa/aegis:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      AEGIS_ISSUER: https://auth.example.com
      AEGIS_ENCRYPTION_KEY: ${AEGIS_ENCRYPTION_KEY}
      AEGIS_DATABASE_URL: postgres://aegis:${POSTGRES_PASSWORD}@postgres:5432/aegis
      AEGIS_TRUST_PROXY: "1"
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:18-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: aegis
      POSTGRES_USER: aegis
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aegis -d aegis"]
      interval: 5s
      retries: 20

volumes:
  postgres-data:
```

Create the secrets in a `.env` file next to it:

```bash
echo "AEGIS_ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" >> .env
```

Then start Aegis:

```bash
docker compose up -d
```

Keep `AEGIS_ENCRYPTION_KEY` safe. It encrypts signing keys, client secrets and the SMTP password, and
Aegis cannot read them without it. See [Configuration](configuration.md) for all options.

## First start

Open `AEGIS_ISSUER` in your browser. As long as there is no account, Aegis shows the setup, where you
choose the instance name and create the first administrator. After that the setup is closed for
good.

> [!IMPORTANT]
> Until the setup is finished, anyone who can reach Aegis can create the administrator account.
> Complete it right after the first start, before making Aegis publicly reachable. The example above
> only listens on `127.0.0.1`.

## Reverse proxy

Aegis expects a reverse proxy in front of it that terminates TLS. It has to run at the root of its
own domain, not under a path.

With Caddy:

```caddyfile
auth.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

Set `AEGIS_ISSUER` to the public URL (`https://auth.example.com`) and `AEGIS_TRUST_PROXY` to `1`, so
Aegis reads the client IP and protocol from the `X-Forwarded-*` headers. Only trust the proxy if Aegis
cannot be reached any other way.

## Updates

Aegis follows [Semantic Versioning](https://semver.org) and publishes these image tags:

| Tag | Updates to |
| --- | --- |
| `latest` | every stable release |
| `1` | every 1.x release, never a breaking change |
| `1.0` | bug fixes of 1.0 only |
| `1.0.0` | nothing, always exactly this release |
| `edge` | every change on `main`, unreleased and only for testing |

Aegis looks for new releases on its own: Settings → General shows the running version, and a hint in the
sidebar appears as soon as a newer release is out. It only asks GitHub's public API for the latest release;
turn it off with `AEGIS_UPDATE_CHECK=false`.

For production, pin the major version (`ghcr.io/walkaisa/aegis:1`) or an exact release and read the
[changelog](../CHANGELOG.md) before upgrading to a new major version. Then update with:

```bash
docker compose pull
docker compose up -d
```

Migrations are applied on startup. Back up the database first (see below), because migrations cannot
be rolled back by starting an older image.

## Backup and restore

Back up the database and `AEGIS_ENCRYPTION_KEY`. Without the key, signing keys, client secrets and the
SMTP password cannot be decrypted.

```bash
docker compose exec -T postgres pg_dump -U aegis -d aegis --format=custom > aegis.dump
docker compose exec -T postgres pg_restore -U aegis -d aegis --clean --if-exists < aegis.dump
```
