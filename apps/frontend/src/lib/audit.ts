import type { AuditQuery } from "@aegis/contracts";

/** Time ranges offered above the audit log; `0` means "everything that is still kept". */
export const AUDIT_RANGE_HOURS = [24, 24 * 7, 24 * 30, 0] as const;

export const DEFAULT_AUDIT_RANGE_HOURS: number = 24 * 7;

export function rangeStart(hours: number): string | null {
	return hours === 0 ? null : new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export type AuditFilters = Pick<AuditQuery, "categories" | "severities" | "outcomes" | "sources" | "search" | "order"> & {
	from: string | null;
	to: string | null;
};

/** Builds the query string of `/api/audit/events`; `page` is omitted for `/api/audit/summary`. */
export function auditQueryString(filters: AuditFilters, page?: { page: number; perPage: number }): string {
	const query = new URLSearchParams();

	if (page) {
		query.set("page", String(page.page));
		query.set("perPage", String(page.perPage));
	}

	for (const [key, values] of Object.entries({
		categories: filters.categories,
		severities: filters.severities,
		outcomes: filters.outcomes,
		sources: filters.sources,
	})) {
		if (values.length > 0) {
			query.set(key, values.join(","));
		}
	}

	if (filters.search.length > 0) {
		query.set("search", filters.search);
	}
	if (filters.from !== null) {
		query.set("from", filters.from);
	}
	if (filters.to !== null) {
		query.set("to", filters.to);
	}
	if (filters.order !== "newest") {
		query.set("order", filters.order);
	}

	return query.toString();
}
