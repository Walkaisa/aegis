import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { ApplicationQuickstart } from "@/components/applications/application-quickstart";
import { renderApplication, SPA, WIKI } from "../../../support/applications";
import { NOW } from "../../../support/fixtures";
import { pressOutside } from "../../../support/interactions";
import { MESSAGES } from "../../../support/render";

const t = MESSAGES.en;

const DISCOVERY = {
	issuer: "https://auth.example.com",
	authorization_endpoint: "https://auth.example.com/oauth2/authorize",
	token_endpoint: "https://auth.example.com/oauth2/token",
	userinfo_endpoint: "https://auth.example.com/oauth2/userinfo",
	jwks_uri: "https://auth.example.com/.well-known/jwks.json",
	end_session_endpoint: "https://auth.example.com/oauth2/sign-out",
	revocation_endpoint: "https://auth.example.com/oauth2/revoke",
};

describe("ApplicationQuickstart", () => {
	it("shows the credentials, a configuration per library and the endpoints", async () => {
		vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
		await renderApplication(
			<ApplicationQuickstart />,
			{ ...WIKI, lastAuthorizedAt: NOW },
			{
				"GET /.well-known/openid-configuration": { body: DISCOVERY },
				"POST /api/applications/:id/secret": { body: { client: WIKI, clientSecret: "new-secret" } },
			},
		);

		await expect.element(page.getByLabelText(t.quickstart.issuer)).toHaveValue("https://auth.example.com");
		await expect.poll(() => document.body.textContent).toContain("AUTH_AEGIS_SECRET=your-client-secret");
		await page.getByRole("radio", { name: "oauth2-proxy" }).click();
		await expect.element(page.getByText("oauth2-proxy.cfg")).toBeVisible();
		await page.getByRole("radio", { name: "oauth2-proxy" }).click();
		await expect.element(page.getByText("oauth2-proxy.cfg")).toBeVisible();
		await expect.element(page.getByLabelText(t.quickstart.endpointLabels.revocation)).toHaveValue(DISCOVERY.revocation_endpoint);

		await page.getByRole("button", { name: t.quickstart.rotateSecret }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: t.quickstart.rotateConfirm }).click();
		await expect.element(page.getByText(t.secretDialog.title)).toBeVisible();
		await expect.element(page.getByLabelText(t.secretDialog.clientSecret)).toHaveValue("new-secret");
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await page.getByRole("checkbox", { name: t.secretDialog.confirm }).click();
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
	});

	it("explains public clients", async () => {
		await renderApplication(
			<ApplicationQuickstart />,
			{ ...SPA, redirectUris: [], skipConsent: true },
			{
				"GET /.well-known/openid-configuration": {
					body: { ...DISCOVERY, end_session_endpoint: undefined, revocation_endpoint: undefined },
				},
			},
		);

		await expect.element(page.getByText(t.quickstart.publicClientNotice)).toBeVisible();
		await expect.element(page.getByText(t.quickstart.noClientAuthentication)).toBeVisible();
		await expect.element(page.getByText(t.quickstart.consentSkipped)).toBeVisible();
		expect(page.getByText(t.quickstart.none).elements()).toHaveLength(2);
		await expect.poll(() => document.body.textContent).toContain('redirect_uri: ""');
		expect(document.body.textContent).not.toContain("your-client-secret");
	});

	it("waits for the discovery document", async () => {
		await renderApplication(<ApplicationQuickstart />, WIKI, { "GET /.well-known/openid-configuration": "pending" });

		expect(document.querySelectorAll("[aria-busy='true']")).toHaveLength(3);
	});

	it("closes the secret dialog with its button", async () => {
		vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
		await renderApplication(
			<ApplicationQuickstart />,
			{ ...WIKI, secretRotatedAt: null },
			{
				"GET /.well-known/openid-configuration": { body: { ...DISCOVERY, end_session_endpoint: undefined } },
				"POST /api/applications/:id/secret": { body: { client: WIKI, clientSecret: "new-secret" } },
			},
		);

		await expect.element(page.getByText(t.quickstart.secretHidden)).toBeVisible();
		await expect.element(page.getByLabelText(t.quickstart.endpointLabels.endSession)).not.toBeInTheDocument();
		await page.getByRole("button", { name: t.quickstart.rotateSecret }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: t.quickstart.rotateConfirm }).click();
		await expect.element(page.getByText(t.secretDialog.title)).toBeVisible();
		await pressOutside();
		await expect.element(page.getByText(t.secretDialog.title)).toBeVisible();
		await page.getByRole("checkbox", { name: t.secretDialog.confirm }).click();
		await page.getByRole("button", { name: t.secretDialog.done }).click();
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
	});
});
