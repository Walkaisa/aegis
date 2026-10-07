import { describe, expect, it } from "vitest";
import { AVATAR_HASH_PATTERN, applicationLogoUrl, avatarUrl } from "../src/media";

describe("media URLs", () => {
	it("change with the content hash and are absent without a picture", () => {
		expect(avatarUrl("1", "a".repeat(32))).toBe(`/api/media/avatars/1/${"a".repeat(32)}.webp`);
		expect(avatarUrl("1", null)).toBeNull();
		expect(applicationLogoUrl("2", "b".repeat(32))).toBe(`/api/media/logos/2/${"b".repeat(32)}.webp`);
		expect(applicationLogoUrl("2", null)).toBeNull();
		expect(AVATAR_HASH_PATTERN.test("0123456789abcdef0123456789abcdef")).toBe(true);
		expect(AVATAR_HASH_PATTERN.test("0123456789ABCDEF0123456789ABCDEF")).toBe(false);
	});
});
