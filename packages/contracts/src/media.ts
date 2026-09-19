import { API_PREFIX } from "./api";
import type { Snowflake } from "./snowflakes";

/** Edge length in pixels of the square WebP the server stores for every profile picture and application logo. */
export const AVATAR_SIZE = 512;

/** Upper bound for an uploaded picture; the web UI crops and downsizes before uploading. */
export const AVATAR_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Image formats accepted as upload body. The server re-encodes every upload to WebP. */
export const AVATAR_UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type AvatarUploadType = (typeof AVATAR_UPLOAD_TYPES)[number];

/** Content hash of a stored picture: 32 lowercase hex characters. */
export const AVATAR_HASH_PATTERN = /^[0-9a-f]{32}$/;

/**
 * URL of a profile picture, `/api/media/avatars/<account id>/<hash>.webp`. Like Discord's avatar
 * URLs it changes with every new picture, so responses can be cached immutably.
 */
export function avatarUrl(accountId: Snowflake, hash: string | null): string | null {
	return hash ? `${API_PREFIX}/media/avatars/${accountId}/${hash}.webp` : null;
}

/**
 * URL of an application logo, `/api/media/logos/<application id>/<hash>.webp`. Logos are public:
 * the sign-in and consent pages show them before anyone is signed in.
 */
export function applicationLogoUrl(applicationId: Snowflake, hash: string | null): string | null {
	return hash ? `${API_PREFIX}/media/logos/${applicationId}/${hash}.webp` : null;
}
