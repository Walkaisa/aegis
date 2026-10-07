import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { ApplicationSettings } from "@/components/applications/application-settings";
import { apiError } from "../../../support/api";
import { renderApplication, SPA, WIKI } from "../../../support/applications";
import { NOW } from "../../../support/fixtures";
import { router } from "../../../support/next/navigation";
import { MESSAGES, translate } from "../../../support/render";

const t = MESSAGES.en;

describe("ApplicationSettings", () => {
	it("saves changed settings", async () => {
		const { server } = await renderApplication(<ApplicationSettings />, WIKI, {
			"PUT /api/applications/:id": ({ body }) => ({ body: { client: { ...WIKI, ...(body as object), updatedAt: NOW } } }),
		});

		await page.getByLabelText(t.clientForm.name).fill("Team Wiki");
		await page.getByLabelText(t.clientForm.description).fill("The wiki");
		await page.getByRole("button", { name: t.clientForm.addUri }).first().click();
		await page.getByRole("textbox", { name: `${t.clientForm.redirectUris} 2` }).fill("http://localhost:3000/callback");
		await page.getByRole("button", { name: t.clientForm.addUri }).nth(1).click();
		await page.getByRole("textbox", { name: `${t.clientForm.postSignOutRedirectUris} 2` }).fill("https://wiki.example.com/bye");
		await page.getByRole("button", { name: t.clientForm.removeUri }).nth(2).click();
		await page.getByRole("checkbox", { name: /profile/ }).click();
		await page.getByRole("combobox", { name: t.clientForm.authMethod }).click();
		await page.getByRole("option", { name: t.clientForm.authMethods.client_secret_post }).click();
		await page.getByRole("combobox", { name: t.clientForm.pkce }).click();
		await page.getByRole("option", { name: t.clientForm.pkcePolicies.required }).click();
		await page.getByRole("switch", { name: t.clientForm.skipConsent }).click();
		await page.getByRole("switch", { name: t.clientForm.enabled }).click();
		await page.getByRole("button", { name: t.common.saveChanges }).click();

		await expect.element(page.getByText(t.clientForm.saved)).toBeVisible();
		expect(server.calls("PUT /api/applications/:id")[0]?.body).toEqual({
			name: "Team Wiki",
			description: "The wiki",
			tokenEndpointAuthMethod: "client_secret_post",
			redirectUris: ["https://wiki.example.com/api/auth/callback/aegis", "http://localhost:3000/callback"],
			postLogoutRedirectUris: ["https://wiki.example.com/bye"],
			allowedScopes: ["openid", "email"],
			skipConsent: true,
			pkcePolicy: "required",
			enabled: false,
			accessPolicy: "everyone",
		});
	});

	it("points out invalid settings before and after saving", async () => {
		const { server } = await renderApplication(
			<ApplicationSettings />,
			{ ...WIKI, redirectUris: [] },
			{
				"PUT /api/applications/:id": apiError(400, "validation_failed", [
					{ path: "name", code: "too_long" },
					{ path: "description", code: "too_long" },
					{ path: "allowedScopes", code: "scope_openid_required" },
					{ path: "pkcePolicy", code: "invalid" },
				]),
			},
		);

		await page.getByRole("textbox", { name: `${t.clientForm.redirectUris} 1` }).fill("https://wiki.example.com/*");
		await page.getByRole("button", { name: t.common.saveChanges }).click();
		await expect.element(page.getByText(t.clientForm.fixErrors)).toBeVisible();
		await expect.element(page.getByText(t.validation.redirect_uri_wildcard)).toBeVisible();

		await page.getByRole("textbox", { name: `${t.clientForm.redirectUris} 1` }).fill("https://wiki.example.com/cb");
		await page.getByRole("checkbox", { name: /profile/ }).click();
		await page.getByRole("checkbox", { name: /profile/ }).click();
		await page.getByRole("button", { name: t.common.saveChanges }).click();
		await expect.poll(() => page.getByText(t.validation.too_long).elements().length).toBe(2);
		await expect.element(page.getByText(t.validation.scope_openid_required)).toBeVisible();
		await expect.element(page.getByRole("combobox", { name: t.clientForm.pkce })).toHaveAttribute("aria-invalid", "true");

		server.on({ "PUT /api/applications/:id": apiError(500, "internal_error") });
		await page.getByRole("button", { name: t.common.saveChanges }).click();
		await expect.element(page.getByText(t.errors.internal_error)).toBeVisible();

		await page.getByRole("button", { name: t.common.discard }).click();
		await expect.element(page.getByRole("button", { name: t.common.saveChanges })).not.toBeInTheDocument();
	});

	it("locks PKCE of public clients and deletes applications", async () => {
		await renderApplication(<ApplicationSettings />, SPA, {
			"DELETE /api/applications/:id": { status: 204 },
			"GET /api/applications/": apiError(404, "not_found"),
		});

		await expect.element(page.getByText(t.clientForm.pkcePublicLocked, { exact: false })).toBeVisible();
		await expect.element(page.getByRole("combobox", { name: t.clientForm.authMethod })).not.toBeInTheDocument();
		await page.getByRole("button", { name: t.clientForm.delete }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: t.clientForm.deleteConfirm }).click();

		await expect.element(page.getByText(translate("clientForm.deleted", { name: "Dashboard" }))).toBeVisible();
		expect(router.push).toHaveBeenLastCalledWith("/applications");
	});
});
