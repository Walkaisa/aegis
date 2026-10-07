import { describe, expect, it } from "vitest";
import { parseUserAgent } from "../src/user-agent";

describe("parseUserAgent", () => {
	it.each([
		[
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0",
			"Edge",
			"Windows",
			false,
		],
		[
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
			"Safari",
			"macOS",
			false,
		],
		[
			"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148",
			"Chrome",
			"iOS",
			true,
		],
		["Mozilla/5.0 (Android 15; Mobile; rv:140.0) Gecko/140.0 Firefox/140.0", "Firefox", "Android", true],
		["Mozilla/5.0 (X11; CrOS x86_64 16000.0.0) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 OPR/120.0", "Opera", "ChromeOS", false],
		["Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0", "Firefox", "Linux", false],
		["curl/8.9.1", "curl", null, false],
		["Something else", null, null, false],
	])("reads %s", (userAgent, browser, os, mobile) => {
		expect(parseUserAgent(userAgent)).toEqual({ browser, os, mobile });
	});

	it("handles a missing user agent", () => {
		expect(parseUserAgent(null)).toEqual({ browser: null, os: null, mobile: false });
	});
});
