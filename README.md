<div align="center">

<img src="apps/web/public/brand/logo.svg" alt="Aegis" width="80" height="80" />

# Aegis

A simple, self-hosted OpenID Connect provider for your own applications.<br />
One account, one sign-in, everywhere.

[Documentation](docs/README.md) · [Installation](docs/installation.md) · [Connect an application](docs/connect-an-application.md)

<br />

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/hero-dark.webp" />
  <source media="(prefers-color-scheme: light)" srcset="docs/screenshots/hero-light.webp" />
  <img src="docs/screenshots/hero-dark.webp" alt="Aegis dashboard" width="100%" />
</picture>

</div>

<br />

Aegis gives the people you work with a single account for all of your applications. Add your apps,
invite your team and everyone signs in the same way, whether it is your wiki, your Git server or
the internal tools you build yourself.

It does one thing and does it well. There is no self-registration, no role system to configure and
no plugin maze. You get a clean admin interface, a login page your users will actually like and a
standards-compliant OpenID Connect provider underneath.

## Highlights

- **Works with any OpenID Connect client**, from Auth.js to oauth2-proxy in front of apps without login.
- **Applications** with logos, exact redirect URIs, scopes per app and secrets you can rotate.
- **Accounts** for your team with profile pictures, sessions you can see and end at any time.
- **Two-factor authentication** with an authenticator app and recovery codes, for the administration and every application.
- **Password reset by e-mail** through your own SMTP server, with confirmed address changes and security notifications.
- **Audit log** of every sign-in and every change, searchable and easy to read.
- **Secure by default** with PKCE (S256) for every public client and configurable per web app, Argon2id and encrypted secrets at rest.
- **Light and dark mode**, English and German, fully responsive.

## Get started

All you need is Docker. Create a `compose.yaml`:

```yaml
services:
  aegis:
    image: ghcr.io/walkaisa/aegis:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      AEGIS_ISSUER: http://localhost:3000
      AEGIS_ENCRYPTION_KEY: ${AEGIS_ENCRYPTION_KEY}
      AEGIS_DATABASE_URL: postgres://aegis:${POSTGRES_PASSWORD}@postgres:5432/aegis
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

Generate the two secrets and start it:

```bash
echo "AEGIS_ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" >> .env
docker compose up -d
```

Open <http://localhost:3000> and create your admin account. That's it.

For running Aegis on your own domain, see the [installation guide](docs/installation.md).

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/applications.webp" alt="Applications" /></td>
    <td width="50%"><img src="docs/screenshots/users.webp" alt="Users" /></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/audit.webp" alt="Audit log" /></td>
    <td width="50%"><img src="docs/screenshots/sign-in.webp" alt="Sign-in page" /></td>
  </tr>
</table>

## Documentation

- [Installation](docs/installation.md): Docker, reverse proxy, backups
- [Configuration](docs/configuration.md): all environment variables
- [Connect an application](docs/connect-an-application.md): Auth.js, oauth2-proxy and claims
- [Accounts](docs/accounts.md): roles, access to applications and sessions
- [Security](docs/security.md): how Aegis protects your accounts
- [Development](docs/development.md): working on Aegis itself
- [Releasing](docs/releasing.md): versions, image tags and the release process

See the [changelog](CHANGELOG.md) for what changed in each release.

## License

Aegis is licensed under the [GNU Affero General Public License v3.0](LICENSE).
