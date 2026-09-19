import { defineConfig } from "tsdown";

/**
 * Bundles `src` into a single `dist/index.js`; `@aegis/contracts`, `@aegis/db` and every runtime
 * dependency stay external and are resolved from `node_modules` at startup. Development runs from
 * `src` through `tsx`, so this is only used by `pnpm build`.
 */
export default defineConfig(({ watch }) => ({
	entry: "src/index.ts",
	platform: "node",
	target: "node24",
	// `"type": "module"` already makes every .js file ESM; no need for .mjs.
	fixedExtension: false,
	sourcemap: true,
	clean: !watch,
	report: !watch,
}));
