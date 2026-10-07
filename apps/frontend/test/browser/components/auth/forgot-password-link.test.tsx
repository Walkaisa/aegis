import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { ForgotPasswordLink } from "@/components/auth/forgot-password-link";
import { MESSAGES, renderUi } from "../../../support/render";

const t = MESSAGES.en.forgotPassword;

describe("ForgotPasswordLink", () => {
	it("leads to the password reset", async () => {
		await renderUi(<ForgotPasswordLink />);

		await expect.element(page.getByRole("link", { name: t.title })).toHaveAttribute("href", "/forgot-password");
	});

	it("keeps the authorization request to return to", async () => {
		await renderUi(<ForgotPasswordLink challenge="a b&c" />);

		await expect.element(page.getByRole("link", { name: t.title })).toHaveAttribute("href", "/forgot-password?challenge=a%20b%26c");
	});
});
