import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { EmailSettings } from "@/components/settings/email-settings";
import { apiError, mockApi } from "../../../support/api";
import { emailSettings } from "../../../support/fixtures";
import { MESSAGES, renderUi, translate } from "../../../support/render";

const tEmail = MESSAGES.en.emailSettings;

describe("EmailSettings", () => {
	it("lays out an empty form, then fills in the stored settings", async () => {
		const server = mockApi({ "GET /api/settings/email": "pending" });
		await renderUi(<EmailSettings />);

		await expect.element(page.getByLabelText(tEmail.port)).toHaveValue(587);
		server.on({ "GET /api/settings/email": { body: emailSettings({ lastVerifiedAt: null, username: null, hasPassword: false }) } });
	});

	it("saves changed settings and keeps the stored password for the same server", async () => {
		const server = mockApi({
			"GET /api/settings/email": { body: emailSettings() },
			"PUT /api/settings/email": ({ body }) => ({ body: emailSettings({ ...(body as object), hasPassword: true }) }),
		});
		await renderUi(<EmailSettings />);

		await expect.element(page.getByLabelText(tEmail.host)).toHaveValue("smtp.example.com");
		await expect.element(page.getByText(/^Last successfully checked on save/)).toBeVisible();
		await expect.element(page.getByText(tEmail.passwordKept)).toBeVisible();
		await page.getByLabelText(tEmail.fromName).fill("Team SSO");
		await page.getByLabelText(tEmail.fromAddress).fill("login@example.com");
		await page.getByLabelText(/Reply-to address/).fill("help@example.com");
		await expect.element(page.getByText(tEmail.saveHint)).toBeVisible();
		await page.getByRole("button", { name: MESSAGES.en.common.saveChanges }).click();

		await expect.element(page.getByText(tEmail.saved)).toBeVisible();
		expect(server.calls("PUT /api/settings/email")[0]?.body).toEqual({
			enabled: true,
			host: "smtp.example.com",
			port: 587,
			security: "starttls",
			username: "aegis",
			fromName: "Team SSO",
			fromAddress: "login@example.com",
			replyTo: "help@example.com",
			allowInvalidCertificate: false,
		});
	});

	it("asks for the password again for another server and switches the port with the encryption", async () => {
		const server = mockApi({
			"GET /api/settings/email": { body: emailSettings() },
			"PUT /api/settings/email": { body: emailSettings() },
		});
		await renderUi(<EmailSettings />);
		await expect.element(page.getByLabelText(tEmail.host)).toHaveValue("smtp.example.com");

		await page.getByRole("combobox", { name: tEmail.security }).click();
		await page.getByRole("option", { name: tEmail.securityModes.tls }).click();
		await expect.element(page.getByLabelText(tEmail.port)).toHaveValue(465);
		await expect.element(page.getByText(tEmail.passwordRequired)).toBeVisible();
		await page.getByRole("button", { name: MESSAGES.en.common.saveChanges }).click();
		await expect.element(page.getByText(MESSAGES.en.validation.required)).toBeVisible();
		expect(server.calls("PUT /api/settings/email")).toEqual([]);

		await page.getByLabelText(tEmail.port).fill("2525");
		await page.getByRole("combobox", { name: tEmail.security }).click();
		await page.getByRole("option", { name: tEmail.securityModes.none }).click();
		await expect.element(page.getByLabelText(tEmail.port)).toHaveValue(2525);
		await page.getByRole("switch", { name: tEmail.allowInvalidCertificate }).click();
		await page.getByLabelText(tEmail.password, { exact: true }).fill("s3cret");
		await page.getByRole("switch", { name: tEmail.enabled }).click();
		await expect.element(page.getByText(tEmail.saveHint)).not.toBeInTheDocument();
		await page.getByRole("button", { name: MESSAGES.en.common.saveChanges }).click();
		await expect.element(page.getByText(tEmail.saved)).toBeVisible();
		expect(server.calls("PUT /api/settings/email")[0]?.body).toMatchObject({
			password: "s3cret",
			security: "none",
			port: 2525,
			enabled: false,
		});
	});

	it("keeps the stored password only while server and account stay the same", async () => {
		mockApi({ "GET /api/settings/email": { body: emailSettings() } });
		await renderUi(<EmailSettings />);
		await expect.element(page.getByText(tEmail.passwordKept)).toBeVisible();

		await page.getByLabelText(tEmail.host).fill("mail.example.com");
		await expect.element(page.getByText(tEmail.passwordRequired)).toBeVisible();
		await page.getByLabelText(tEmail.host).fill(" smtp.example.com ");
		await expect.element(page.getByText(tEmail.passwordKept)).toBeVisible();

		await page.getByLabelText(tEmail.username).fill("");
		await expect.element(page.getByText(tEmail.passwordRequired)).toBeVisible();
	});

	it("tests the connection and sends a test message", async () => {
		const server = mockApi({
			"GET /api/settings/email": { body: emailSettings({ lastVerifiedAt: null }) },
			"POST /api/settings/email/test": ({ body }) => ({
				body:
					(body as { mode: string }).mode === "send"
						? { mode: "send", durationMs: 50, deliveredTo: "ada@example.com" }
						: { mode: "verify", durationMs: 42, deliveredTo: null },
			}),
		});
		await renderUi(<EmailSettings />);
		await expect.element(page.getByText(tEmail.neverVerified)).toBeVisible();

		await page.getByRole("button", { name: tEmail.testActions }).click();
		await page.getByRole("menuitem", { name: new RegExp(tEmail.test) }).click();
		await expect.element(page.getByText(translate("emailSettings.testSucceeded", { ms: 42 })).first()).toBeVisible();

		await page.getByRole("button", { name: tEmail.testActions }).click();
		await page.getByRole("menuitem", { name: new RegExp(tEmail.sendTest) }).click();
		await expect.element(page.getByText(translate("emailSettings.testDelivered", { email: "ada@example.com" })).first()).toBeVisible();
		expect(server.calls("POST /api/settings/email/test").map((call) => (call.body as { mode: string }).mode)).toEqual([
			"verify",
			"send",
		]);
	});

	it("reports failures with the reply of the server", async () => {
		const server = mockApi({
			"GET /api/settings/email": { body: emailSettings({ username: null, hasPassword: false }) },
			"POST /api/settings/email/test": {
				status: 502,
				body: { error: { code: "smtp_connection_failed", message: "535 Authentication failed" } },
			},
			"PUT /api/settings/email": apiError(
				400,
				"validation_failed",
				["host", "username", "fromName", "fromAddress", "replyTo"].map((path) => ({ path, code: "invalid" })),
			),
		});
		await renderUi(<EmailSettings />);
		await expect.element(page.getByText(tEmail.passwordStored)).toBeVisible();

		await page.getByRole("button", { name: tEmail.testActions }).click();
		await page.getByRole("menuitem", { name: new RegExp(tEmail.test) }).click();
		await expect.element(page.getByText("535 Authentication failed")).toBeVisible();
		await expect.element(page.getByText(MESSAGES.en.errors.smtp_connection_failed)).toBeVisible();

		await page.getByLabelText(tEmail.username).fill("mailer");
		await page.getByRole("button", { name: tEmail.testActions }).click();
		await page.getByRole("menuitem", { name: new RegExp(tEmail.test) }).click();
		await expect.element(page.getByText(MESSAGES.en.validation.required)).toBeVisible();
		await page.getByRole("button", { name: MESSAGES.en.common.saveChanges }).click();
		expect(server.calls("PUT /api/settings/email")).toEqual([]);

		await page.getByLabelText(tEmail.password, { exact: true }).fill("s3cret");
		await page.getByRole("button", { name: MESSAGES.en.common.saveChanges }).click();
		for (const label of [tEmail.host, tEmail.username, tEmail.fromName, tEmail.fromAddress, /Reply-to address/]) {
			await expect.element(page.getByLabelText(label)).toHaveAttribute("aria-invalid", "true");
		}

		server.on({ "PUT /api/settings/email": apiError(500, "internal_error") });
		await page.getByRole("button", { name: MESSAGES.en.common.saveChanges }).click();
		await expect.element(page.getByRole("alert").getByText(MESSAGES.en.errors.internal_error)).toBeVisible();

		await page.getByRole("button", { name: MESSAGES.en.common.discard }).click();
		await expect.element(page.getByRole("button", { name: MESSAGES.en.common.saveChanges })).not.toBeInTheDocument();

		await page.getByLabelText(tEmail.port).fill("");
		await page.getByRole("button", { name: MESSAGES.en.common.saveChanges }).click();
		await expect.element(page.getByText(MESSAGES.en.validation.invalid)).toBeVisible();
	});

	it("offers a retry when the settings cannot be loaded", async () => {
		const server = mockApi({ "GET /api/settings/email": apiError(500, "internal_error") });
		await renderUi(<EmailSettings />);

		await expect.element(page.getByText(MESSAGES.en.common.loadFailed)).toBeVisible();
		server.on({ "GET /api/settings/email": { body: emailSettings() } });
		await page.getByRole("button", { name: MESSAGES.en.common.retry }).click();
		await expect.element(page.getByLabelText(tEmail.host)).toHaveValue("smtp.example.com");
	});
});
