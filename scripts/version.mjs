// Verifies that every package.json and apps/server/src/version.ts carry the same version.
// release-please bumps them together (see release-please-config.json); this guards against a file
// being missed there or edited by hand.
//
//   node scripts/version.mjs            all files agree
//   node scripts/version.mjs 1.2.0      all files agree and equal 1.2.0 (used by the release workflow)
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const MANIFESTS = [
	"package.json",
	"apps/server/package.json",
	"apps/web/package.json",
	"packages/contracts/package.json",
	"packages/db/package.json",
	"packages/email/package.json",
];
const VERSION_MODULE = "apps/server/src/version.ts";
const VERSION_EXPORT = /export const AEGIS_VERSION = "([^"]+)";/;

const read = (file) => readFileSync(join(root, file), "utf8");

const versions = MANIFESTS.map((file) => [file, JSON.parse(read(file)).version]);
versions.push([VERSION_MODULE, read(VERSION_MODULE).match(VERSION_EXPORT)?.[1]]);
versions.push([".release-please-manifest.json", JSON.parse(read(".release-please-manifest.json"))["."]]);

const expected = process.argv[2] ?? versions[0][1];
const mismatches = versions.filter(([, version]) => version !== expected);
if (mismatches.length > 0) {
	console.error(`Expected version ${expected}, but found:\n${mismatches.map(([file, version]) => `  ${file}: ${version}`).join("\n")}`);
	process.exit(1);
}
console.log(`All files are at version ${expected}`);
