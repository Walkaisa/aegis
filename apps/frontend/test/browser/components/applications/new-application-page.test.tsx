import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { NewApplicationPage } from "@/components/applications/new-application-page";
import { apiError, mockApi } from "../../../support/api";
import { client } from "../../../support/fixtures";
import { router, setLocation } from "../../../support/next/navigation";
import { MESSAGES, renderUi, translate } from "../../../support/render";

const t = MESSAGES.en;

describe("NewApplicationPage", () => {
	it("creates a web application and shows its secret once", async () => {
		const server = mockApi({
			"GET /api/instance": { body: { instanceName: "Example SSO", issuer: "https://auth.example.com" } },
			"POST /api/applications": ({ body }) => ({
				status: 201,
				body: { client: client({ ...(body as object), id: "9" }), clientSecret: "s3cret" },
			}),
		});
		vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
		await renderUi(<NewApplicationPage />);

		await page.getByRole("button", { name: t.newApplication.next }).click();
		await expect.element(page.getByText(t.validation.required)).toBeVisible();
		await page.getByLabelText(t.newApplication.name).fill("Wiki");
		await page.getByRole("button", { name: t.newApplication.next }).click();

		await page.getByRole("radio", { name: "oauth2-proxy" }).click();
		await page.getByLabelText(t.newApplication.baseUrl).fill("http://wiki.example.com");
		await page.getByRole("button", { name: t.newApplication.create }).click();
		await expect.element(page.getByText(t.validation.redirect_uri_insecure).first()).toBeVisible();

		await page.getByLabelText(t.newApplication.baseUrl).fill("https://wiki.example.com/");
		await expect.element(page.getByLabelText(t.newApplication.redirectUri)).toHaveValue("https://wiki.example.com/oauth2/callback");
		await page.getByLabelText(t.newApplication.signOutUri).fill("https://wiki.example.com/bye");
		await page.getByRole("switch", { name: t.newApplication.skipConsent }).click();
		await page.getByRole("button", { name: t.newApplication.create }).click();

		await expect.element(page.getByText(translate("newApplication.done.title", { name: "Wiki" }))).toBeVisible();
		expect(server.calls("POST /api/applications")[0]?.body).toMatchObject({
			name: "Wiki",
			type: "confidential",
			redirectUris: ["https://wiki.example.com/oauth2/callback"],
			postLogoutRedirectUris: ["https://wiki.example.com/bye"],
			skipConsent: false,
			pkcePolicy: "optional",
		});
		await expect
			.element(page.getByText(translate("newApplication.done.snippetHeading", { integration: "oauth2-proxy" })))
			.toBeVisible();
		const open = page.getByRole("button", { name: t.newApplication.done.openApplication });
		await expect.element(open).toBeDisabled();
		await page.getByRole("checkbox", { name: t.newApplication.done.confirm }).click();
		await open.click();
		expect(router.push).toHaveBeenLastCalledWith("/applications/9");
	});

	it("creates a native app without a secret and checks its redirect", async () => {
		setLocation("/applications/new?kind=native");
		const server = mockApi({
			"GET /api/instance": "pending",
			"POST /api/applications": apiError(400, "validation_failed", [
				{ path: "redirectUris.0", code: "redirect_uri_invalid" },
				{ path: "postLogoutRedirectUris.0", code: "redirect_uri_fragment" },
			]),
		});
		await renderUi(<NewApplicationPage />);

		await expect.element(page.getByRole("radio", { name: new RegExp(t.applicationKinds.native.title) })).toBeChecked();
		await page.getByLabelText(t.newApplication.name).fill("Mobile");
		await page.getByRole("button", { name: t.newApplication.next }).click();
		await expect.element(page.getByLabelText(t.newApplication.baseUrl)).not.toBeInTheDocument();
		await expect.element(page.getByRole("switch")).not.toBeInTheDocument();
		await page.getByRole("button", { name: t.newApplication.create }).click();
		await expect.element(page.getByText(t.validation.required).first()).toBeVisible();

		await page.getByLabelText(t.newApplication.redirectUri).fill("com.example.app:/callback");
		await page.getByRole("checkbox", { name: /email/ }).click();
		await page.getByRole("button", { name: t.newApplication.create }).click();
		await expect.element(page.getByText(t.validation.redirect_uri_invalid)).toBeVisible();
		await expect.element(page.getByText(t.validation.redirect_uri_fragment)).toBeVisible();

		server.on({ "POST /api/applications": apiError(503, "setup_required") });
		await page.getByRole("button", { name: t.newApplication.create }).click();
		await expect.element(page.getByText(t.errors.setup_required)).toBeVisible();

		server.on({
			"POST /api/applications": ({ body }) => ({
				status: 201,
				body: { client: client({ ...(body as object), id: "10", redirectUris: [] }), clientSecret: null },
			}),
		});
		await page.getByRole("button", { name: t.newApplication.create }).click();
		await expect.element(page.getByText(t.newApplication.done.publicNoticeTitle)).toBeVisible();
		expect(server.calls("POST /api/applications").at(-1)?.body).toMatchObject({
			type: "public",
			allowedScopes: ["openid", "profile"],
			skipConsent: false,
		});
		await page.getByRole("button", { name: t.newApplication.done.openApplication }).click();
		expect(router.push).toHaveBeenLastCalledWith("/applications/10");
	});

	it("switches kinds, integrations and steps", async () => {
		setLocation("/applications/new?kind=unknown");
		mockApi({ "GET /api/instance": { body: { instanceName: "Example SSO", issuer: "https://auth.example.com" } } });
		await renderUi(<NewApplicationPage />);

		await page.getByLabelText(t.newApplication.name).fill("x".repeat(100));
		await page.getByRole("radio", { name: new RegExp(t.applicationKinds.spa.title) }).click();
		await page.getByRole("button", { name: t.newApplication.next }).click();
		await expect.element(page.getByRole("radio", { name: "oidc-client-ts" })).toBeChecked();
		await page.getByRole("radio", { name: t.newApplication.genericIntegration }).click();
		await page.getByLabelText(t.newApplication.baseUrl).fill("https://spa.example.com");
		await expect.element(page.getByLabelText(t.newApplication.redirectUri)).toHaveValue("https://spa.example.com/auth/callback");
		await page.getByLabelText(t.newApplication.redirectUri).fill("https://spa.example.com/own");
		await page.getByRole("button", { name: t.newApplication.previous }).click();

		await page.getByLabelText(t.newApplication.name).fill("   ");
		await page.getByRole("button", { name: t.newApplication.next }).click();
		await expect.element(page.getByText(t.validation.required)).toBeVisible();
	});
});
