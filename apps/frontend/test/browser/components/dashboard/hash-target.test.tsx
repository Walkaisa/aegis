import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { HashTarget } from "@/components/dashboard/hash-target";
import { renderUi } from "../../../support/render";

describe("HashTarget", () => {
	it("keeps the target of a link in view while the page grows, until the reader scrolls", async () => {
		const scroll = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
		window.history.replaceState(null, "", "/settings#version");
		await renderUi(
			<div>
				<div data-testid="filler" />
				<section id="version">Version</section>
				<HashTarget />
			</div>,
		);

		page.getByTestId("filler").element().setAttribute("style", "height: 200px");
		await vi.waitFor(() => expect(scroll).toHaveBeenCalled());
		window.dispatchEvent(new WheelEvent("wheel"));
		scroll.mockClear();
		page.getByTestId("filler").element().setAttribute("style", "height: 400px");
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(scroll).not.toHaveBeenCalled();
	});

	it("stops following after a few seconds and ignores pages without a fragment", async () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		try {
			window.history.replaceState(null, "", "/settings#version");
			const observe = vi.spyOn(ResizeObserver.prototype, "disconnect");
			await renderUi(<HashTarget />);
			vi.advanceTimersByTime(3000);
			expect(observe).toHaveBeenCalled();

			observe.mockClear();
			window.history.replaceState(null, "", "/settings");
			await renderUi(<HashTarget />);
			expect(observe).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});
});
