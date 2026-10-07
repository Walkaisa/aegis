import { useMemo, useSyncExternalStore } from "react";
import { vi } from "vitest";

/**
 * `next/navigation` for component tests: the location lives here instead of in the Next.js router,
 * and `router.push()`/`router.replace()` change it, so components re-render like after a
 * client-side navigation.
 */

let location = new URL("http://localhost:3000/");
const listeners = new Set<() => void>();

function navigate(href: string): void {
	location = new URL(href, location);
	for (const listener of listeners) {
		listener();
	}
}

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

export const router = {
	push: vi.fn(navigate),
	replace: vi.fn(navigate),
	refresh: vi.fn(),
	back: vi.fn(),
	forward: vi.fn(),
	prefetch: vi.fn(),
};

/** Sets the current URL, e.g. `setLocation("/users/1?tab=x")`, and notifies the rendered components. */
export function setLocation(href: string): void {
	navigate(href);
}

export function currentLocation(): URL {
	return location;
}

export function resetNavigation(): void {
	location = new URL("http://localhost:3000/");
	listeners.clear();
	for (const method of Object.values(router)) {
		method.mockClear();
	}
}

const snapshot = () => location.href;

export function useRouter() {
	return router;
}

export function usePathname(): string {
	const href = useSyncExternalStore(subscribe, snapshot, snapshot);
	return new URL(href).pathname;
}

export function useSearchParams(): URLSearchParams {
	const href = useSyncExternalStore(subscribe, snapshot, snapshot);
	return useMemo(() => new URL(href).searchParams, [href]);
}

export function useParams(): Record<string, string> {
	return {};
}
