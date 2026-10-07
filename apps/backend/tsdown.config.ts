import { defineConfig } from "tsdown";

/**
 * Bundles `src` into `dist/index.js`, plus a chunk with the proxy to the Next.js development server
 * that only development loads. `@aegis/contracts`, `@aegis/db` and every runtime dependency stay
 * external and are resolved from `node_modules` at startup; so does the proxy, a development
 * dependency that the Docker image does not contain. Development runs from `src` through `tsx`, so
 * this is only used by `pnpm build`.
 */
export default defineConfig(({ watch }) => ({
	entry: "src/index.ts",
	platform: "node",
	target: "node24",
	// `"type": "module"` already makes every .js file ESM; no need for .mjs.
	fixedExtension: false,
	deps: { neverBundle: ["@fastify/http-proxy"] },
	sourcemap: true,
	clean: !watch,
	report: !watch,
}));
