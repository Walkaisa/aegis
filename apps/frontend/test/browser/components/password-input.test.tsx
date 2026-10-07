import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { PasswordInput } from "@/components/password-input";
import { MESSAGES, renderUi } from "../../support/render";

const t = MESSAGES.en;

describe("form controls", () => {
	it("show and hide a password", async () => {
		await renderUi(<PasswordInput aria-label="Password" icon={<span data-testid="lock" />} defaultValue="s3cret" />);
		const input = page.getByLabelText("Password", { exact: true });

		await expect.element(input).toHaveAttribute("type", "password");
		await page.getByRole("button", { name: t.common.showPassword }).click();
		await expect.element(input).toHaveAttribute("type", "text");
		await page.getByRole("button", { name: t.common.hidePassword }).click();
		await expect.element(input).toHaveAttribute("type", "password");
		await expect.element(page.getByTestId("lock")).toBeInTheDocument();
	});

	it("show a password field without an icon", async () => {
		const screen = await renderUi(<PasswordInput aria-label="Password" />);

		expect(screen.container.querySelectorAll("[data-slot='input-group-addon']")).toHaveLength(1);
	});
});
