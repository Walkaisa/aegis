import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { useBreadcrumbs } from "@/components/dashboard/breadcrumbs";

describe("useBreadcrumbs", () => {
	it("leaves breadcrumbs alone outside the administration", async () => {
		function Named() {
			useBreadcrumbs([{ label: "Somewhere" }]);
			return <p>named</p>;
		}

		await render(<Named />);
		await expect.element(page.getByText("named")).toBeVisible();
	});
});
