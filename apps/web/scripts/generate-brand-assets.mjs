/**
 * Regenerates every icon in `public/` from `public/brand/logo.svg`.
 *
 *   pnpm --filter @aegis/web brand:generate
 *
 * The generated files are committed, so the build needs neither this script nor `sharp`.
 */
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const publicDir = new URL("../public/", import.meta.url);

/** The mark on its dark square, edge to edge. Used wherever the icon keeps its own padding. */
const logo = readFileSync(new URL("brand/logo.svg", publicDir), "utf8");
/** Cropped to the mark, because browser tabs render the icon at 16 px. */
const favicon = logo.replace('viewBox="0 0 200 200"', 'viewBox="20 20 160 160"');
/** Safari pinned tabs expect a single-colour silhouette without a background. */
const mask = favicon.replace(/\s*<rect[^>]+\/>/, "").replaceAll("#fff", "#000");

for (const directory of ["brand/", "icons/"]) {
	await mkdir(new URL(directory, publicDir), { recursive: true });
}

/** Rasterizes at the target size directly, so the vector stays crisp instead of being downscaled. */
async function png(svg, size) {
	return sharp(Buffer.from(svg), { density: (72 * size * 4) / 200 })
		.resize(size, size)
		.removeAlpha()
		.png({ compressionLevel: 9 })
		.toBuffer();
}

/**
 * A classic ICO with 32-bit BMP frames (bottom-up rows, BGRA, empty AND mask). PNG-compressed
 * frames would be smaller but are only understood from Windows Vista onwards.
 */
async function ico(svg, sizes) {
	const frames = [];
	for (const size of sizes) {
		const rgba = await sharp(await png(svg, size))
			.ensureAlpha()
			.raw()
			.toBuffer();
		const pixels = Buffer.alloc(size * size * 4);
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const from = (y * size + x) * 4;
				const to = ((size - 1 - y) * size + x) * 4;
				pixels[to] = rgba[from + 2];
				pixels[to + 1] = rgba[from + 1];
				pixels[to + 2] = rgba[from];
				pixels[to + 3] = 255;
			}
		}
		const andMask = Buffer.alloc(Math.ceil(size / 32) * 4 * size);
		const header = Buffer.alloc(40);
		header.writeUInt32LE(40, 0);
		header.writeInt32LE(size, 4);
		header.writeInt32LE(size * 2, 8);
		header.writeUInt16LE(1, 12);
		header.writeUInt16LE(32, 14);
		header.writeUInt32LE(pixels.length + andMask.length, 20);
		frames.push(Buffer.concat([header, pixels, andMask]));
	}

	const directory = Buffer.alloc(6 + sizes.length * 16);
	directory.writeUInt16LE(1, 2);
	directory.writeUInt16LE(sizes.length, 4);
	let offset = directory.length;
	for (const [index, frame] of frames.entries()) {
		const entry = 6 + index * 16;
		directory[entry] = sizes[index];
		directory[entry + 1] = sizes[index];
		directory.writeUInt16LE(1, entry + 4);
		directory.writeUInt16LE(32, entry + 6);
		directory.writeUInt32LE(frame.length, entry + 8);
		directory.writeUInt32LE(offset, entry + 12);
		offset += frame.length;
	}
	return Buffer.concat([directory, ...frames]);
}

const vectors = [
	["icons/icon.svg", favicon],
	["icons/safari-pinned-tab.svg", mask],
];
const rasters = [
	["icons/icon-96.png", favicon, 96],
	// Android home screens mask these; the mark stays inside the central 80 % safe zone.
	["icons/icon-192.png", logo, 192],
	["icons/icon-512.png", logo, 512],
	// iOS applies its own rounded mask and never renders transparency.
	["apple-touch-icon.png", logo, 180],
	["brand/logo.png", logo, 1024],
];

for (const [path, svg] of vectors) {
	await writeFile(new URL(path, publicDir), svg);
}
for (const [path, svg, size] of rasters) {
	await writeFile(new URL(path, publicDir), await png(svg, size));
}
await writeFile(new URL("favicon.ico", publicDir), await ico(favicon, [16, 32, 48]));

console.log(`Generated ${vectors.length + rasters.length + 1} brand assets in apps/web/public.`);
