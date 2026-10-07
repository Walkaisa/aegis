export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export function toIso(date: Date): string {
	return date.toISOString();
}

export function toIsoOrNull(date: Date | null): string | null {
	return date ? date.toISOString() : null;
}

export function toEpochSeconds(date: Date): number {
	return Math.floor(date.getTime() / SECOND_MS);
}
