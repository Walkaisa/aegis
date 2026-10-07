import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { FormField } from "@/components/form-field";
import { IconInput } from "@/components/icon-input";
import { renderUi } from "../../support/render";

describe("form controls", () => {
	it("label a control and show its description until there is an error", async () => {
		const { rerender } = await renderUi(
			<FormField id="name" label="Name" description="As shown to others">
				<IconInput id="name" icon={<span data-testid="icon" />} />
			</FormField>,
		);

		await expect.element(page.getByLabelText("Name")).toBeVisible();
		await expect.element(page.getByText("As shown to others")).toBeVisible();
		await expect.element(page.getByTestId("icon")).toBeInTheDocument();

		await rerender(
			<FormField id="name" label="Name" description="As shown to others" error="Required">
				<IconInput id="name" />
			</FormField>,
		);
		await expect.element(page.getByText("Required")).toBeVisible();
		await expect.element(page.getByText("As shown to others")).not.toBeInTheDocument();
	});
});
