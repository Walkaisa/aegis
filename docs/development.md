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

`pnpm dev:db` starts PostgreSQL on `127.0.0.1:5432`. `pnpm dev` starts the server on port 3000 and the
web interface on port 3001. Always open <http://localhost:3000>; the server forwards everything that
isn't an API or protocol route to the interface.

To inspect the local database with Drizzle Studio, start PostgreSQL first and run `pnpm db:studio`.
Studio uses the same `AEGIS_DATABASE_URL` as the server and is available at the URL printed by Drizzle Kit.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | Type check all packages |
| `pnpm check` | Lint and format check with Biome |
| `pnpm check:fix` | Apply Biome fixes |
| `pnpm db:generate` | Generate a migration from the database schema |
| `pnpm db:studio` | Start Drizzle Studio for the configured PostgreSQL database |
| `pnpm docker:up` | Build and start the Compose stack |
| `pnpm --filter @aegis/web brand:generate` | Regenerate icons from `apps/web/public/brand/logo.svg` |

## Project layout

| Path | Contents |
| --- | --- |
| `apps/server` | Fastify, [oidc-provider](https://github.com/panva/node-oidc-provider), API and database access |
| `apps/web` | Next.js interface with shadcn/ui |
| `packages/contracts` | Shared schemas and types |
| `packages/db` | Drizzle schema and SQL migrations |
| `packages/email` | Transactional e-mails, written with React and rendered to HTML and plain text |

## Conventions

- Pull request titles follow [Conventional Commits](https://www.conventionalcommits.org) (`feat: …`, `fix: …`); they decide the next release. See [Releasing](releasing.md).
- Every class member has an explicit `public`, `private` or `protected` modifier.
- The server runs as native ESM, so relative imports use the `.js` extension.
- shadcn/ui components are added with `pnpm dlx shadcn@latest add <component>` in `apps/web`.
- All IDs are snowflakes: 64-bit, time-ordered, stored as `bigint` and sent as strings.
- API routes live in `apps/server/src/http/api`, in folders that mirror their paths, and declare who may call them with `access(...)`. See [API](api.md).
