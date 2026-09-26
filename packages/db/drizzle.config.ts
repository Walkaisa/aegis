import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "drizzle-kit";

const ENV_FILE = "../../.env";

if (existsSync(ENV_FILE)) {
	loadEnvFile(ENV_FILE);
}

// Migrations are generated from the schema (`pnpm db:generate --name <description>`) and applied
// automatically by the server on startup. No database connection is needed to generate them.
export default defineConfig({
	dialect: "postgresql",
	schema: "./src/schema/index.ts",
	out: "./migrations",
	dbCredentials: {
		url: process.env.AEGIS_DATABASE_URL ?? "",
	},
	strict: true,
});
