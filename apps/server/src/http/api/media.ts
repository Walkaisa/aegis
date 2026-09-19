import { snowflakeSchema } from "@aegis/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { notFound } from "../../lib/errors.js";
import { parseInput } from "../../lib/validation.js";
import { access } from "../access.js";

const imageFileSchema = z.object({
	id: snowflakeSchema,
	file: z.string().regex(/^[0-9a-f]{32}\.webp$/, { error: "invalid" }),
});

/** Browsers and CDNs may cache an image for good: a new image always gets a new hash and thus a new URL. */
const IMMUTABLE_PUBLIC = "public, max-age=31536000, immutable";

/** Looks up the current image of an account or application by the hash in its URL. */
type ImageLookup = (id: string, hash: string) => Promise<Buffer | null>;

/**
 * `/api/media`: profile pictures (`/avatars/:id/:hash.webp`) and application logos
 * (`/logos/:id/:hash.webp`). Public like Discord's avatar URLs: applications receive profile
 * pictures as the OIDC `picture` claim, and the sign-in and consent pages show logos before anyone
 * is signed in. Only the current image resolves, and its 128-bit content hash cannot be guessed.
 */
export async function mediaRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;

	const serve = (find: ImageLookup) => async (request: FastifyRequest, reply: FastifyReply) => {
		const { id, file } = parseInput(imageFileSchema, request.params);
		const image = await find(id, file.slice(0, -".webp".length));
		if (!image) {
			throw notFound("Image");
		}
		return (
			reply
				.header("content-type", "image/webp")
				.header("content-disposition", "inline")
				.header("cache-control", IMMUTABLE_PUBLIC)
				// Applications embed profile pictures and logos from their own origin.
				.header("cross-origin-resource-policy", "cross-origin")
				.send(image)
		);
	};

	app.get(
		"/avatars/:id/:file",
		access("public"),
		serve((id, hash) => services.avatars.findImage(id, hash)),
	);
	app.get(
		"/logos/:id/:file",
		access("public"),
		serve((id, hash) => services.clientLogos.findImage(id, hash)),
	);
}
