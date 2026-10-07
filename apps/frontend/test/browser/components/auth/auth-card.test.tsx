import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { AuthCard, AuthPending } from "@/components/auth/auth-card";
import { renderUi } from "../../../support/render";

describe("AuthCard", () => {
	it("shows the brand, the visual, the form and the footer", async () => {
		await renderUi(
			<AuthCard brandName="Example SSO" icon={<span data-testid="icon" />} title="Sign in" description="Welcome" footer="Footer">
				<form aria-label="Form" />
			</AuthCard>,
		);

		await expect.element(page.getByText("Example SSO")).toBeVisible();
		await expect.element(page.getByTestId("icon")).toBeInTheDocument();
		await expect.element(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
		await expect.element(page.getByText("Welcome")).toBeVisible();
		await expect.element(page.getByRole("form", { name: "Form" })).toBeInTheDocument();
		await expect.element(page.getByText("Footer")).toBeVisible();
	});

	it("prefers a custom visual and leaves out what it is not given", async () => {
		const { container } = await renderUi(
			<AuthCard media={<span data-testid="media" />} icon={<span data-testid="icon" />} title="Done" />,
		);

		await expect.element(page.getByText("Aegis")).toBeVisible();
		await expect.element(page.getByTestId("media")).toBeInTheDocument();
		await expect.element(page.getByTestId("icon")).not.toBeInTheDocument();
		expect(container.querySelectorAll("p")).toHaveLength(0);
	});

	it("can stand without any visual", async () => {
		const { container } = await renderUi(<AuthCard title="Plain" />);

		expect(container.querySelector(".rounded-xl.border")).toBeNull();
	});
});

describe("AuthPending", () => {
	it("shows a spinner while the page reads its URL", async () => {
		await renderUi(<AuthPending />);

		await expect.element(page.getByRole("status", { name: "Loading" })).toBeVisible();
	});
});
