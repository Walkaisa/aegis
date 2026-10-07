import type { OidcClientRecord } from "@aegis/db";
import { describe, expect, it } from "vitest";
import { toAuthRequestClient } from "../../../src/http/api/dto.js";

describe("toAuthRequestClient", () => {
	const client = { id: "1", name: "Wiki", description: "", logoHash: null } as OidcClientRecord;

	it("names where the application will receive the answer", () => {
		expect(toAuthRequestClient(client, "https://wiki.example.com/callback").redirectOrigin).toBe("wiki.example.com");
		expect(toAuthRequestClient(client, "com.example.app:/callback").redirectOrigin).toBe("com.example.app");
		expect(toAuthRequestClient(client, null).redirectOrigin).toBeNull();
		expect(toAuthRequestClient(client, "not a url").redirectOrigin).toBeNull();
	});
});
