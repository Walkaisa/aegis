import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { OidcError } from "@/components/auth/oidc-error";
import { setLocation } from "../../../support/next/navigation";
import { MESSAGES, renderUi } from "../../../support/render";

const t = MESSAGES.en.oidcError;

describe("OidcError", () => {
	it("explains a known error and shows its details", async () => {
		setLocation("/error?error=access_denied&error_description=The%20user%20denied%20access");
		await renderUi(<OidcError />);

		await expect.element(page.getByRole("heading", { name: t.access_denied.title })).toBeVisible();
		await expect.element(page.getByText(t.access_denied.description)).toBeVisible();
		await page.getByText(t.details).click();
		await expect.element(page.getByText("access_denied", { exact: true })).toBeVisible();
		await expect.element(page.getByText("The user denied access")).toBeVisible();
		await expect.element(page.getByRole("link", { name: t.home })).toHaveAttribute("href", "/");
	});

	it("falls back to a general message for unknown errors and caps what it shows", async () => {
		setLocation(`/error?error=${"x".repeat(150)}`);
		await renderUi(<OidcError />);

		await expect.element(page.getByRole("heading", { name: t.default.title })).toBeVisible();
		await page.getByText(t.details).click();
		await expect.element(page.getByText("x".repeat(100), { exact: true })).toBeVisible();
		await expect.element(page.getByText("error_description")).not.toBeInTheDocument();
	});

	it("reports a server error when the page is opened without one", async () => {
		setLocation("/error");
		await renderUi(<OidcError />);

		await expect.element(page.getByRole("heading", { name: t.server_error.title })).toBeVisible();
	});
});
