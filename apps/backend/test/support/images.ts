import sharp from "sharp";

/** A small solid-colour image, as the web UI uploads after cropping. */
export function testImage(format: "png" | "jpeg" | "webp" = "png", red = 80): Promise<Buffer> {
	return sharp({ create: { width: 64, height: 64, channels: 3, background: { r: red, g: 70, b: 229 } } })
		.toFormat(format)
		.toBuffer();
}
