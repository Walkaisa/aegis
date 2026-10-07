import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPage, reloadPage } from "@/lib/browser";

describe("browser", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("leaves the page with a full page load", () => {
		const location = { assign: vi.fn(), reload: vi.fn() };
		vi.stubGlobal("window", { location });

		loadPage("/sign-in");
		reloadPage();

		expect(location.assign).toHaveBeenCalledWith("/sign-in");
		expect(location.reload).toHaveBeenCalledOnce();
	});
});
