import { describe, expect, it } from "vitest";
import { formatDateTime, formatDuration } from "../src/format";

const requestedAt = new Date(Date.UTC(2026, 8, 27, 10, 30));

describe("formatting", () => {
	it("writes times in UTC and says so", () => {
		expect(formatDateTime(requestedAt, "en")).toMatch(/Sep 27, 2026.*10:30.*UTC$/);
		expect(formatDateTime(requestedAt, "de")).toMatch(/27\.09\.2026.*10:30 UTC$/);
	});

	it("uses the largest unit that fits a duration exactly", () => {
		expect(formatDuration(2 * 24 * 60 * 60_000, "en")).toBe("2 days");
		expect(formatDuration(24 * 60 * 60_000, "de")).toBe("1 Tag");
		expect(formatDuration(60 * 60_000, "en")).toBe("1 hour");
		expect(formatDuration(30 * 60_000, "de")).toBe("30 Minuten");
	});
});
