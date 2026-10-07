import { describe, expect, it } from "vitest";
import { messagesFor } from "../../src/messages/index";

describe("messagesFor", () => {
	it("falls back to the default language", () => {
		expect(messagesFor("fr" as never)).toBe(messagesFor("en"));
		expect(messagesFor("de")).not.toBe(messagesFor("en"));
	});
});
