# Development

## Requirements

- Node.js 24
- pnpm 11 (`corepack enable`)
- Docker for the local database

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm dev:db
pnpm dev
```

`pnpm dev:db` starts PostgreSQL on `127.0.0.1:5432`. `pnpm dev` starts the backend on port 3000 with
automatic restarts and the Next.js development server of the frontend on port 3001 with hot reloading.
Always open <http://localhost:3000>: the backend forwards every page to the development server, so
cookies, redirects and sign-ins work exactly as in production.

To inspect the local database with Drizzle Studio, start PostgreSQL first and run `pnpm db:studio`.
Studio uses the same `AEGIS_DATABASE_URL` as the backend and is available at the URL printed by Drizzle Kit.

## How it runs

Aegis is a single Fastify application. The frontend is built with Next.js, but only into static files;
there is no Next.js server in production.

```text
Browser ──> Fastify (apps/backend, port 3000)
            ├── /api/*                       JSON API
            ├── /.well-known/*, /oauth2/*    OpenID Connect
            └── everything else              frontend pages and files
                ├── production:  static export in apps/frontend/out
                └── development: Next.js development server on 127.0.0.1:3001
```

- `pnpm build` exports every page of the frontend once per language, for example
  `apps/frontend/out/de/users/[id]/settings.html`. Pages with an id in their URL are exported once and
  serve every id.
- The backend picks the page for a URL: `/users/123/settings` in German is served from that file. The
  language comes from the preference cookie or the browser's `Accept-Language` header, so URLs carry no
  language prefix. Unknown URLs get the 404 page, and nothing below `/api`, `/oauth2` or `/.well-known`
  ever falls through to the frontend.
- The sign-in to an application shares its URL, `/sign-in?challenge=`, with the sign-in to the
  administration. It is exported as a page of its own (`sign-in/application`), which the backend serves
  when the URL carries a `challenge`, so both show their form before any JavaScript runs.
- Before a page is served, the backend applies its access rules: without an account every page leads to
  the setup, and the administration requires a signed-in admin.
- Each page gets a Content Security Policy that allows its inline scripts by their SHA-256 hash.
- In development the backend applies the same rules and rewrites the URL for the development server,
  for example `/users/123/settings` to `/de/users/[id]/settings`.

`pnpm build && pnpm start` runs the production build locally.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Backend and frontend with automatic reloading |
| `pnpm build` | Build all packages, including the static export of the frontend |
| `pnpm start` | Run the production build of the backend, which serves the built frontend |
| `pnpm typecheck` | Type check all packages |
| `pnpm check` | Lint and format check with Biome |
| `pnpm check:fix` | Apply Biome fixes |
| `pnpm test` | Run every test with coverage; anything below 100 % fails |
| `pnpm test:watch` | Rerun the affected tests on every change |
| `pnpm test:e2e` | Run the end-to-end tests against a Docker image, see [Testing](#testing) |
| `pnpm db:generate` | Generate a migration from the database schema |
| `pnpm db:studio` | Start Drizzle Studio for the configured PostgreSQL database |
| `pnpm docker:up` | Build and start the Compose stack |
| `bash scripts/smoke-test.sh <image>` | Check a built Docker image end to end, as CI does |
| `pnpm --filter @aegis/frontend brand:generate` | Regenerate icons from `apps/frontend/public/brand/logo.svg` |

## Project layout

| Path | Contents |
| --- | --- |
| `apps/backend` | Fastify, [oidc-provider](https://github.com/panva/node-oidc-provider), API, database access and delivery of the frontend |
| `apps/frontend` | Next.js interface with shadcn/ui, exported as static files |
| `packages/contracts` | Shared schemas and types |
| `packages/db` | Drizzle schema and SQL migrations |
| `packages/email` | Transactional e-mails, written with React and rendered to HTML and plain text |
| `e2e` | End-to-end tests of the Docker image with Playwright |

## Testing

All tests run with [Vitest](https://vitest.dev) in a single run with one merged coverage report.
Coverage is held at 100 % of statements, branches, functions and lines; CI fails below that, and code
that cannot be reached is removed rather than excluded. Docker must be running for the backend tests,
and `pnpm exec playwright install chromium` installs the browser for the component tests once.

| Project | Runs in | What it covers |
| --- | --- | --- |
| `packages` | Node.js | Contracts, database schema and e-mail templates |
| `backend` | Node.js | The API, the OpenID Connect provider and the services, through real HTTP requests against a real PostgreSQL ([Testcontainers](https://testcontainers.com)) |
| `frontend` | Chromium | Components, hooks and helpers, rendered and used like in the browser ([Vitest browser mode](https://vitest.dev/guide/browser/)) |
| `frontend-node` | Node.js | What Next.js runs while it exports the pages: layouts, pages, metadata and translations |

Tests live next to `src/` in a `test/` folder of each workspace and mirror its layout, so the tests of
`apps/backend/src/http/api/users/user.ts` are in `apps/backend/test/http/api/users/user.test.ts`. Shared
helpers are in `test/support/`, global setup in `test/setup/`. The frontend splits its tests by where
they run: `test/browser/` and `test/node/`.

- Backend tests build the real Fastify app per test with `test` from `test/support/aegis.ts`; every test
  file gets its own database, cloned from a migrated template in milliseconds.
- Frontend tests answer API calls with `mockApi` from `test/support/api.ts`; a request without a route
  fails the test. Fixtures of API responses are in `test/support/fixtures.ts`.
- Prefer what a user sees and does (roles, labels, clicks) over implementation details.

### End-to-end tests

[Playwright](https://playwright.dev) tests in `e2e/` drive the Docker image in a real browser: the
first-run setup, the administration and a complete OpenID Connect sign-in of an application with
consent, token exchange and sign-out. PostgreSQL and the image start in containers; CI runs them
against the image it just built.

```bash
docker build -t aegis:e2e .
pnpm test:e2e
```

`AEGIS_E2E_IMAGE` selects another image tag.

## Conventions

- Pull request titles follow [Conventional Commits](https://www.conventionalcommits.org) (`feat: …`, `fix: …`); they decide the next release. See [Releasing](releasing.md).
- Every class member has an explicit `public`, `private` or `protected` modifier.
- The backend runs as native ESM, so relative imports use the `.js` extension.
- The frontend is a static export: it has no server-side code at runtime. Anything that needs a request, a
  session or a secret belongs in the backend and reaches the frontend through the API.
- shadcn/ui components are added with `pnpm dlx shadcn@latest add <component>` in `apps/frontend`.
- All IDs are snowflakes: 64-bit, time-ordered, stored as `bigint` and sent as strings.
- API routes live in `apps/backend/src/http/api`, in folders that mirror their paths, and declare who may call them with `access(...)`. See [API](api.md).
