"use client";

import { usePathname } from "next/navigation";

/**
 * The id in the URL of a detail page, e.g. `<id>` in `/users/<id>/settings`. Detail pages are
 * exported once, as `users/[id]`, and the backend serves that export for every id; the route
 * parameter therefore only holds the placeholder, while the URL carries the actual id.
 */
export function useRouteId(): string {
	return usePathname().split("/")[2] ?? "";
}
