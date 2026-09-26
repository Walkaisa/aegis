import { defineConfig } from "tsdown";

/**
 * Bundles the templates into `dist`. The output runs inside `apps/server`, so React and the
 * React Email components stay external and are resolved from `node_modules` at runtime.
 *
 * Like `@aegis/contracts`, the watch mode never empties the output directory: the server runs
 * from `dist` while this watcher is live.
 */
export default defineConfig(({ watch }) => ({
	entry: "src/index.ts",
	platform: "node",
	target: "node24",
	fixedExtension: false,
	dts: true,
	sourcemap: true,
	clean: !watch,
	report: !watch,
}));
