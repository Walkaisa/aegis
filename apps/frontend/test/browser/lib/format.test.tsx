import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { useDateFormat } from "@/lib/format";
import { Providers } from "../../support/render";

describe("useDateFormat", () => {
	it("formats dates in the locale and relative to now", async () => {
		const { result } = await renderHook(() => useDateFormat(), { wrapper: Providers });
		const format = result.current;
		const ago = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();

		expect(format.date("2026-01-02T03:04:05Z")).toBe("Jan 2, 2026");
		expect(format.dateTime("2026-01-02T03:04:05Z")).toContain("Jan 2, 2026");
		expect(format.time("2026-01-02T15:04:05Z")).toMatch(/\d{1,2}:04/);
		expect(format.relative(ago(5))).toBe("5 seconds ago");
		expect(format.relative(ago(120))).toBe("2 minutes ago");
		expect(format.relative(ago(3 * 86_400))).toBe("3 days ago");
		expect(format.relative(ago(-2 * 365 * 86_400))).toBe("in 2 years");
	});
});
