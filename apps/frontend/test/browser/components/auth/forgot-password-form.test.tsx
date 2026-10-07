import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { apiError, mockApi } from "../../../support/api";
import { instanceInfo } from "../../../support/fixtures";
import { setLocation } from "../../../support/next/navigation";
import { MESSAGES, renderUi, translate } from "../../../support/render";

const t = MESSAGES.en.forgotPassword;

describe("ForgotPasswordForm", () => {
	it("sends a reset link and confirms without revealing whether the account exists", async () => {
		const server = mockApi({ "GET /api/instance": { body: instanceInfo() }, "POST /api/auth/password-reset": { status: 204 } });
		await renderUi(<ForgotPasswordForm />);

		await expect.element(page.getByText("Example SSO")).toBeVisible();
		await expect.element(page.getByRole("link", { name: t.back })).toHaveAttribute("href", "/sign-in");
		await page.getByLabelText(t.email).fill(" ada@example.com ");
		await page.getByRole("button", { name: t.submit }).click();

		await expect.element(page.getByText(translate("forgotPassword.sentDescription", { email: "ada@example.com" }))).toBeVisible();
		expect(server.calls("POST /api/auth/password-reset")[0]?.body).toEqual({ email: "ada@example.com" });

		await page.getByRole("button", { name: t.again }).click();
		await expect.element(page.getByLabelText(t.email)).toHaveValue("");
	});

	it("leads back to the sign-in of the application it came from", async () => {
		setLocation("/forgot-password?challenge=abc");
		mockApi({ "GET /api/instance": "pending" });
		await renderUi(<ForgotPasswordForm />);

		await expect.element(page.getByText("Aegis")).toBeVisible();
		await expect.element(page.getByRole("link", { name: t.back })).toHaveAttribute("href", "/sign-in?challenge=abc");
	});

	it("checks the address and reports failures", async () => {
		const server = mockApi({
			"GET /api/instance": { body: instanceInfo() },
			"POST /api/auth/password-reset": apiError(429, "rate_limited"),
		});
		await renderUi(<ForgotPasswordForm />);

		await page.getByRole("button", { name: t.submit }).click();
		await expect.element(page.getByText(MESSAGES.en.validation.required)).toBeVisible();
		expect(server.calls("POST /api/auth/password-reset")).toEqual([]);

		await page.getByLabelText(t.email).fill("ada@example.com");
		await page.getByRole("button", { name: t.submit }).click();
		await expect.element(page.getByText(MESSAGES.en.errors.rate_limited)).toBeVisible();

		server.on({ "POST /api/auth/password-reset": apiError(400, "validation_failed", [{ path: "email", code: "email_invalid" }]) });
		await page.getByRole("button", { name: t.submit }).click();
		await expect.element(page.getByText(MESSAGES.en.validation.email_invalid)).toBeVisible();
		await expect.element(page.getByText(MESSAGES.en.errors.rate_limited)).not.toBeInTheDocument();
	});
});
