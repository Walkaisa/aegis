import { describe, expect, it, vi } from "vitest";
import { type AuditFilters, auditQueryString, rangeStart } from "@/lib/audit";

describe("audit", () => {
	const filters: AuditFilters = {
		categories: [],
		severities: [],
		outcomes: [],
		sources: [],
		search: "",
		from: null,
		to: null,
		order: "newest",
	};

	it("starts ranges the given hours ago, or never", () => {
		vi.useFakeTimers({ now: Date.UTC(2026, 0, 2) });
		try {
			expect(rangeStart(24)).toBe("2026-01-01T00:00:00.000Z");
			expect(rangeStart(0)).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it("puts only the set filters into the query", () => {
		expect(auditQueryString(filters)).toBe("");
		expect(auditQueryString(filters, { page: 2, perPage: 50 })).toBe("page=2&perPage=50");
		expect(
			auditQueryString({
				categories: ["users", "applications"],
				severities: ["warning"],
				outcomes: ["failure"],
				sources: ["admin"],
				search: "ada",
				from: "2026-01-01T00:00:00.000Z",
				to: "2026-01-02T00:00:00.000Z",
				order: "oldest",
			}),
		).toBe(
			"categories=users%2Capplications&severities=warning&outcomes=failure&sources=admin&search=ada&from=2026-01-01T00%3A00%3A00.000Z&to=2026-01-02T00%3A00%3A00.000Z&order=oldest",
		);
	});
});
