"use client";

import { useSearchParams } from "next/navigation";

/**
 * The authorization request a sign-in or consent page belongs to (`?challenge=`). Pages are
 * prerendered without their URL, so a component reading it needs a `<Suspense>` boundary above.
 */
export function useChallenge(): string | null {
	return useSearchParams().get("challenge");
}
