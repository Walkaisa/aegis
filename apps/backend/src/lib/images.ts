import { createHash } from "node:crypto";
import { AVATAR_SIZE } from "@aegis/contracts";
import sharp from "sharp";
import { ApiError } from "./errors.js";

/** Decoding stops beyond this many pixels, so a tiny file cannot expand into a huge bitmap. */
const MAX_INPUT_PIXELS = 6000 * 6000;
const ACCEPTED_FORMATS = new Set(["png", "jpeg", "webp"]);
const WEBP_QUALITY = 86;

const invalidImage = () => new ApiError(400, "invalid_image", "The file is not a supported image");

export interface SquareImage {
	image: Buffer;
	/** First 32 hex characters of the SHA-256 of `image`; part of the image URL. */
	hash: string;
}

/**
 * Profile pictures and application logos are never stored as sent: an upload is decoded, oriented,
 * cropped to a square, resized and re-encoded as WebP. This strips metadata (EXIF, GPS) and
 * anything that is not pixel data.
 */
export async function normalizeSquareImage(upload: Buffer): Promise<SquareImage> {
	let image: Buffer;
	try {
		const input = sharp(upload, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
		const { format } = await input.metadata();
		if (!format || !ACCEPTED_FORMATS.has(format)) {
			throw invalidImage();
		}
		image = await input
			.rotate()
			.resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "centre" })
			.webp({ quality: WEBP_QUALITY })
			.toBuffer();
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}
		throw invalidImage();
	}
	return { image, hash: createHash("sha256").update(image).digest("hex").slice(0, 32) };
}
