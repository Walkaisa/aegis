import { defineConfig } from "tsdown";

/** See `packages/contracts/tsdown.config.ts`. `migrations/` is shipped as-is next to `dist`. */
export default defineConfig(({ watch }) => ({
	entry: "src/index.ts",
	platform: "node",
	target: "node24",
	// `"type": "module"` already makes every .js file ESM; no need for .mjs.
	fixedExtension: false,
	dts: true,
	sourcemap: true,
	unbundle: true,
	clean: !watch,
	report: !watch,
}));
