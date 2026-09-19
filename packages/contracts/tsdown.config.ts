import { defineConfig } from "tsdown";

/**
 * Bundles `src` into `dist`. A bundler (rather than `tsc`) resolves imports the way the editor
 * does, so source files import `./identity` instead of `./identity.js`.
 *
 * Under `--watch` the output directory is never emptied: `apps/server` runs from `dist` while this
 * watcher is live, and a cleaned directory would crash it. The size report is skipped as well,
 * because it would be printed again on every keystroke.
 */
export default defineConfig(({ watch }) => ({
	entry: "src/index.ts",
	platform: "neutral",
	dts: true,
	sourcemap: true,
	unbundle: true,
	clean: !watch,
	report: !watch,
}));
