import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { VerifyEmailCard } from "@/components/auth/verify-email-card";
import { reloadPage } from "@/lib/browser";
import { apiError, mockApi, type Route } from "../../../support/api";
import { instanceInfo } from "../../../support/fixtures";
import { MESSAGES, renderUi, translate } from "../../../support/render";

const t = MESSAGES.en.verifyEmail;

/** Opens the confirmation page from the link in the e-mail, which carries the token in its fragment. */
async function openLink(fragment: string, routes: Record<string, Route>) {
	window.history.replaceState(null, "", `/verify-email${fragment}`);
	const server = mockApi({ "GET /api/instance": { body: instanceInfo() }, ...routes });
	await renderUi(<VerifyEmailCard />);
	return server;
}

describe("VerifyEmailCard", () => {
	it("confirms the new address once, even though React runs effects twice in development", async () => {
		const server = await openLink("#token=valid-token", {
			"POST /api/auth/email-change/confirm": { body: { email: "new@example.com" } },
		});

		await expect.element(page.getByText(translate("verifyEmail.successDescription", { email: "new@example.com" }))).toBeVisible();
		expect(server.calls("POST /api/auth/email-change/confirm")).toHaveLength(1);
		expect(server.calls("POST /api/auth/email-change/confirm")[0]?.body).toEqual({ token: "valid-token" });
		await expect.element(page.getByRole("link", { name: t.signIn })).toHaveAttribute("href", "/sign-in");
	});

	it("explains a link that can never work", async () => {
		await openLink("#token=used-token", { "POST /api/auth/email-change/confirm": apiError(400, "verification_token_invalid") });

		await expect.element(page.getByText(t.invalidTitle)).toBeVisible();
		await expect.element(page.getByText(MESSAGES.en.errors.verification_token_invalid)).not.toBeInTheDocument();
	});

	it("says when the address was taken in the meantime", async () => {
		await openLink("#token=valid-token", { "POST /api/auth/email-change/confirm": apiError(409, "email_taken") });

		await expect.element(page.getByText(t.invalidTitle)).toBeVisible();
		await expect.element(page.getByText(MESSAGES.en.errors.email_taken)).toBeVisible();
	});

	it("rejects a malformed token without asking the server", async () => {
		const server = await openLink("#token=not/a/token", {});

		await expect.element(page.getByText(t.invalidTitle)).toBeVisible();
		expect(server.calls("POST /api/auth/email-change/confirm")).toEqual([]);
	});

	it("needs the link from the e-mail", async () => {
		await openLink("", {});

		await expect.element(page.getByText(t.missingTitle)).toBeVisible();
	});

	it("offers a retry when the server cannot be reached", async () => {
		await openLink("#token=valid-token", { "POST /api/auth/email-change/confirm": apiError(500, "internal_error") });

		await expect.element(page.getByText(MESSAGES.en.errors.internal_error)).toBeVisible();
		await page.getByRole("button", { name: MESSAGES.en.common.retry }).click();
		expect(reloadPage).toHaveBeenCalledOnce();
	});

	it("shows that the link is being checked", async () => {
		mockApi({ "GET /api/instance": "pending", "POST /api/auth/email-change/confirm": "pending" });
		window.history.replaceState(null, "", "/verify-email#token=valid-token");
		await renderUi(<VerifyEmailCard />);

		await expect.element(page.getByText(t.checking)).toBeVisible();
		await expect.element(page.getByText("Aegis")).toBeVisible();
	});
});
