export interface DeviceInfo {
	browser: string | null;
	os: string | null;
	mobile: boolean;
}

const BROWSERS: [RegExp, string][] = [
	[/Edg(?:e|A|iOS)?\//, "Edge"],
	[/OPR\/|Opera/, "Opera"],
	[/Firefox\/|FxiOS\//, "Firefox"],
	[/Chrome\/|CriOS\//, "Chrome"],
	[/Safari\//, "Safari"],
	[/curl\//, "curl"],
];

const SYSTEMS: [RegExp, string][] = [
	[/iPhone|iPad|iPod/, "iOS"],
	[/Android/, "Android"],
	[/Windows/, "Windows"],
	[/Mac OS X|Macintosh/, "macOS"],
	[/CrOS/, "ChromeOS"],
	[/Linux/, "Linux"],
];

/** Coarse, display-only interpretation of a User-Agent string. */
export function parseUserAgent(userAgent: string | null): DeviceInfo {
	if (!userAgent) {
		return { browser: null, os: null, mobile: false };
	}
	return {
		browser: BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null,
		os: SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null,
		mobile: /Mobi|iPhone|Android/.test(userAgent),
	};
}
