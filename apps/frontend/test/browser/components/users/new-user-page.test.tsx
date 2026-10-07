import { PASSWORD_MIN_LENGTH } from "@aegis/contracts";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { generatePassword, NewUserPage } from "@/components/users/new-user-page";
import { apiError, mockApi } from "../../../support/api";
import { user } from "../../../support/fixtures";
import { router } from "../../../support/next/navigation";
import { MESSAGES, renderUi, translate } from "../../../support/render";

const t = MESSAGES.en;

describe("NewUserPage", () => {
	it("creates an account with a generated password", async () => {
		const server = mockApi({
			"POST /api/users": ({ body }) => ({ status: 201, body: { user: user({ ...(body as object), id: "42" }) } }),
		});
		vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
		await renderUi(<NewUserPage />);

		await page.getByLabelText(t.newUser.displayName).fill("Grace Hopper");
		await page.getByLabelText(t.newUser.email).fill("grace@example.com");
		await page.getByRole("radio", { name: new RegExp(t.roles.admin) }).click();
		await expect.element(page.getByText(t.newUser.adminWarningTitle)).toBeVisible();
		await page.getByRole("switch", { name: t.newUser.emailVerified }).click();
		await page.getByRole("switch", { name: t.newUser.enabled }).click();
		await page.getByRole("button", { name: t.newUser.generate }).click();
		await expect.element(page.getByText(t.newUser.generatedNotice)).toBeVisible();
		await page.getByRole("button", { name: t.newUser.submit }).click();

		await expect.element(page.getByText(translate("newUser.created", { name: "Grace Hopper" }))).toBeVisible();
		expect(router.push).toHaveBeenLastCalledWith("/users/42");
		expect(server.calls("POST /api/users")[0]?.body).toMatchObject({
			displayName: "Grace Hopper",
			email: "grace@example.com",
			role: "admin",
			enabled: false,
			emailVerified: false,
			password: expect.stringMatching(/^[\w-]{24}$/),
		});
	});

	it("validates before sending and shows the errors of the server", async () => {
		const server = mockApi({ "POST /api/users": apiError(409, "email_taken") });
		await renderUi(<NewUserPage />);

		await page.getByRole("button", { name: t.newUser.submit }).click();
		await expect.element(page.getByText(t.validation.required).first()).toBeVisible();
		expect(server.calls("POST /api/users")).toEqual([]);

		await page.getByLabelText(t.newUser.displayName).fill("Grace");
		await page.getByLabelText(t.newUser.email).fill("grace@example.com");
		await page.getByLabelText(t.newUser.password, { exact: true }).fill("a sufficiently long password");
		await expect.element(page.getByText(t.newUser.generatedNotice)).not.toBeInTheDocument();
		await page.getByRole("button", { name: t.newUser.submit }).click();
		await expect.element(page.getByText(t.validation.email_taken)).toBeVisible();

		server.on({ "POST /api/users": apiError(400, "validation_failed", [{ path: "password", code: "password_too_short" }]) });
		await page.getByRole("button", { name: t.newUser.submit }).click();
		await expect.element(page.getByText(translate("validation.password_too_short", { min: PASSWORD_MIN_LENGTH }))).toBeVisible();

		server.on({ "POST /api/users": apiError(503, "setup_required") });
		await page.getByRole("button", { name: t.newUser.submit }).click();
		await expect.element(page.getByText(t.errors.setup_required)).toBeVisible();
	});

	it("generates passwords like the server does", () => {
		expect(generatePassword()).toMatch(/^[\w-]{24}$/);
		expect(generatePassword()).not.toBe(generatePassword());
	});
});
