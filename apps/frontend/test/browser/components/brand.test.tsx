import { describe, expect, it } from "vitest";
import { Brand, BrandMark } from "@/components/brand";
import { renderUi } from "../../support/render";

describe("Brand", () => {
	it("shows the mark next to the instance name", async () => {
		const screen = await renderUi(
			<>
				<Brand name="Example SSO" />
				<BrandMark size="lg" />
			</>,
		);

		await expect.element(screen.getByText("Example SSO")).toBeVisible();
		expect(screen.container.querySelectorAll('img[src="/brand/logo.svg"]')).toHaveLength(2);
	});
});
