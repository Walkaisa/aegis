import { defineConfig } from "drizzle-kit";

// Migrations are generated from the schema (`pnpm db:generate --name <description>`) and applied
// automatically by the server on startup. No database connection is needed to generate them.
export default defineConfig({
	dialect: "postgresql",
	schema: "./src/schema/index.ts",
	out: "./migrations",
	strict: true,
});
