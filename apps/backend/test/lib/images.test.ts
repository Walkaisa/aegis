import { AVATAR_SIZE } from "@aegis/contracts";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { normalizeSquareImage } from "../../src/lib/images.js";

describe("normalizeSquareImage", () => {
	async function image(format: "png" | "jpeg" | "webp" | "gif" | "tiff", width = 800, height = 600) {
		return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 20, b: 20 } } })
			.withMetadata({ exif: { IFD0: { Copyright: "secret" } } })
			.toFormat(format)
			.toBuffer();
	}

	it.each(["png", "jpeg", "webp"] as const)("crops, resizes and re-encodes %s as WebP without metadata", async (format) => {
		const { image: output, hash } = await normalizeSquareImage(await image(format));
		const metadata = await sharp(output).metadata();

		expect(metadata).toMatchObject({ format: "webp", width: AVATAR_SIZE, height: AVATAR_SIZE });
		expect(metadata.exif).toBeUndefined();
		expect(hash).toMatch(/^[0-9a-f]{32}$/);
	});

	it.each(["gif", "tiff"] as const)("rejects %s", async (format) => {
		await expect(normalizeSquareImage(await image(format))).rejects.toMatchObject({ statusCode: 400, code: "invalid_image" });
	});

	it("rejects data that is not an image, and oversized bitmaps", async () => {
		await expect(normalizeSquareImage(Buffer.from("<svg/>"))).rejects.toMatchObject({ code: "invalid_image" });
		await expect(normalizeSquareImage(await image("png", 6001, 6001))).rejects.toMatchObject({ code: "invalid_image" });
	});
});
