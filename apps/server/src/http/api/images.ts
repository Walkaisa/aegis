import { AVATAR_MAX_UPLOAD_BYTES, AVATAR_UPLOAD_TYPES } from "@aegis/contracts";
import type { UserRecord } from "@aegis/db";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ApiError } from "../../lib/errors.js";
import type { RequestMeta } from "../../services/auth.js";
import { type Access, access } from "../access.js";
import { rateLimits } from "../rate-limits.js";
import { requestMeta } from "../request-context.js";

/** Stores normalized square images per owner: `AvatarService` for accounts, `ClientLogoService` for applications. */
interface ImageStore {
	set(ownerId: string, upload: Buffer, actor: UserRecord, meta: RequestMeta): Promise<unknown>;
	remove(ownerId: string, actor: UserRecord, meta: RequestMeta): Promise<unknown>;
}

function uploadedImage(request: FastifyRequest): Buffer {
	if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
		throw new ApiError(415, "unsupported_media_type", "Upload a PNG, JPEG or WebP image");
	}
	return request.body;
}

/**
 * `PUT` (upload) and `DELETE` of the image at the prefix it is registered with, e.g.
 * `/api/users/:id/avatar`. Image bodies are accepted by these routes only; every other route stays
 * JSON-only.
 */
export function imageRoutes(options: {
	/** Who may change the image. */
	access: Access;
	store: ImageStore;
	/** The account or application the image belongs to. */
	ownerOf: (request: FastifyRequest) => string;
	/** The response after a change, e.g. the updated account. */
	respond: (ownerId: string) => Promise<unknown>;
}) {
	const { store, ownerOf, respond } = options;

	return async (app: FastifyInstance): Promise<void> => {
		app.addContentTypeParser(
			[...AVATAR_UPLOAD_TYPES],
			{ parseAs: "buffer", bodyLimit: AVATAR_MAX_UPLOAD_BYTES },
			(_request, body, done) => done(null, body),
		);

		app.put("/", { bodyLimit: AVATAR_MAX_UPLOAD_BYTES, ...access(options.access, rateLimits.sensitive) }, async (request) => {
			const owner = ownerOf(request);
			await store.set(owner, uploadedImage(request), request.auth.user, requestMeta(request));
			return respond(owner);
		});

		app.delete("/", access(options.access), async (request) => {
			const owner = ownerOf(request);
			await store.remove(owner, request.auth.user, requestMeta(request));
			return respond(owner);
		});
	};
}
