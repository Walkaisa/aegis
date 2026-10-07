import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { PasswordStrength } from "@/components/password-strength";
import { MESSAGES, renderUi } from "../../support/render";

const t = MESSAGES.en;

describe("form controls", () => {
	it("rate a new password and list the requirements it meets", async () => {
		const { rerender, container } = await renderUi(<PasswordStrength password="" />);
		expect(container.querySelector("[aria-hidden='true']")?.textContent).toContain(`${t.password.strength}:`);

		await rerender(<PasswordStrength password="abc" />);
		await expect.element(page.getByRole("status")).toHaveTextContent(`${t.password.strength}: ${t.password.levels.weak}`);
		await expect.element(page.getByText(t.password.requirements.lowercase)).toBeVisible();

		await rerender(<PasswordStrength password="Correct-Horse-7-Battery" />);
		await expect.element(page.getByRole("status")).toHaveTextContent(`${t.password.strength}: ${t.password.levels.strong}`);
		expect(page.getByText(t.password.met, { exact: true }).elements()).toHaveLength(5);
	});
});
