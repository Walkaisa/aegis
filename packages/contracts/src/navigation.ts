/** Stands in for the origin of Aegis: paths are resolved against it only to see whether they stay there. */
const ORIGIN = "https://aegis.invalid";

export interface LocalPath {
	/** The path without query and fragment, for matching it against pages. */
	pathname: string;
	/** The path with query and fragment, to navigate to. */
	path: string;
}

/**
 * Resolves `value`, a path from a URL parameter such as `?next=`, the way browsers do: they drop
 * tabs and line breaks, treat `\` like `/` and remove `.` segments, so prefix checks on the raw
 * value cannot tell whether `/\t/evil.example` leaves Aegis. `null` for anything that is not a path
 * on the same origin, or would not be one after the normalization.
 */
export function localPath(value: string | null | undefined): LocalPath | null {
	if (!value?.startsWith("/")) {
		return null;
	}
	const url = URL.parse(value, ORIGIN);
	if (url?.origin !== ORIGIN || url.pathname.startsWith("//")) {
		return null;
	}
	return { pathname: url.pathname, path: `${url.pathname}${url.search}${url.hash}` };
}
