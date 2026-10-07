import type { AuthRequestContextResponse } from "@aegis/contracts";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { AuthRequestFlow } from "@/components/auth/auth-request-flow";
import { loadPage, reloadPage } from "@/lib/browser";
import { apiError, mockApi, type Route } from "../../../support/api";
import { authRequestClient, consentPrompt, secondFactorPrompt, signInPrompt } from "../../../support/fixtures";
import { setLocation } from "../../../support/next/navigation";
import { MESSAGES, renderUi, translate } from "../../../support/render";

const t = MESSAGES.en.authRequest;
const tTwoFactor = MESSAGES.en.twoFactor.signIn;
const BASE = "/api/auth/requests/challenge-1";
const REDIRECT = { type: "redirect", redirectTo: "https://wiki.example.com/callback?code=abc" } as const;

/** Opens `/sign-in?challenge=…` for a request the server answers with the given prompt. */
function openRequest(context: AuthRequestContextResponse, routes: Record<string, Route> = {}) {
	return openRequestAnswering({ body: context }, routes);
}

/** Opens `/sign-in?challenge=…` for a request the server answers like this, e.g. with an error. */
async function openRequestAnswering(answer: Route, routes: Record<string, Route> = {}) {
	setLocation("/sign-in?challenge=challenge-1");
	const server = mockApi({ [`GET ${BASE}`]: answer, ...routes });
	await renderUi(<AuthRequestFlow />);
	return server;
}

async function signIn(password = "correct horse battery staple") {
	await page.getByLabelText(t.signIn.email).fill("ada@example.com");
	await page.getByLabelText(t.signIn.password, { exact: true }).fill(password);
	await page.getByRole("button", { name: t.signIn.submit }).click();
}

describe("AuthRequestFlow", () => {
	it("needs an authorization request to continue", async () => {
		await renderUi(<AuthRequestFlow />);

		await expect.element(page.getByRole("heading", { name: t.missing.title })).toBeVisible();
	});

	it("loads the request once and continues straight away when it needs no prompt", async () => {
		const server = await openRequest(REDIRECT);

		await expect.element(page.getByText(t.redirecting)).toBeVisible();
		expect(loadPage).toHaveBeenCalledWith(REDIRECT.redirectTo);
		expect(server.calls(`GET ${BASE}`)).toHaveLength(1);
	});

	it("shows that the request is being loaded", async () => {
		await openRequestAnswering("pending");

		await expect.element(page.getByText(t.loading)).toBeVisible();
	});

	it("explains an expired request", async () => {
		await openRequestAnswering(apiError(410, "auth_request_expired"));
		await expect.element(page.getByRole("heading", { name: t.expired.title })).toBeVisible();
		await expect.element(page.getByText(t.returnNotice)).toBeVisible();
	});

	it("explains a request that failed for another reason", async () => {
		await openRequestAnswering("network-error");

		await expect.element(page.getByRole("heading", { name: t.failed.title })).toBeVisible();
		await expect.element(page.getByText(MESSAGES.en.errors.network_error)).toBeVisible();
	});

	describe("sign-in", () => {
		it("names the application, what it may read and where the user continues", async () => {
			const server = await openRequest(signInPrompt({ scopes: ["openid", "profile", "email"] }), {
				[`POST ${BASE}/sign-in`]: { body: REDIRECT },
			});

			await expect.element(page.getByText("Sign in to continue to Wiki.")).toBeVisible();
			await expect
				.element(page.getByText(translate("authRequest.signIn.redirectNotice", { origin: "https://wiki.example.com" })))
				.toBeVisible();
			await page.getByText(t.signIn.access).click();
			await expect.element(page.getByText(MESSAGES.en.scopes.profile.description)).toBeVisible();
			await expect.element(page.getByRole("link", { name: MESSAGES.en.forgotPassword.title })).not.toBeInTheDocument();
			await signIn();

			expect(server.calls(`POST ${BASE}/sign-in`)[0]?.body).toEqual({
				email: "ada@example.com",
				password: "correct horse battery staple",
			});
			expect(loadPage).toHaveBeenCalledWith(REDIRECT.redirectTo);
		});

		it("suggests the address, asks again when the application demands it and points out a denied account", async () => {
			await openRequest(
				signInPrompt({
					emailHint: "ada@example.com",
					reauthenticationRequired: true,
					deniedAccount: { displayName: "Grace Hopper", email: "grace@example.com", avatarUrl: null },
					passwordResetEnabled: true,
					scopes: [],
					client: authRequestClient({ redirectOrigin: null, logoUrl: "/api/media/logos/7/a.webp" }),
				}),
			);

			await expect.element(page.getByLabelText(t.signIn.email)).toHaveValue("ada@example.com");
			await expect.element(page.getByText(t.signIn.reauthenticationTitle)).toBeVisible();
			await expect.element(page.getByText(/You're signed in as grace@example.com/)).toBeVisible();
			await expect
				.element(page.getByRole("link", { name: MESSAGES.en.forgotPassword.title }))
				.toHaveAttribute("href", "/forgot-password?challenge=challenge-1");
			await expect.element(page.getByText(t.signIn.access)).not.toBeInTheDocument();
			await expect.element(page.getByText(/You will continue to/)).not.toBeInTheDocument();
		});

		it("explains rejected sign-ins and keeps the address", async () => {
			const server = await openRequest(signInPrompt(), { [`POST ${BASE}/sign-in`]: apiError(403, "application_access_denied") });

			await page.getByRole("button", { name: t.signIn.submit }).click();
			expect(page.getByText(MESSAGES.en.validation.required).elements()).toHaveLength(2);
			expect(server.calls(`POST ${BASE}/sign-in`)).toEqual([]);

			await signIn();
			await expect.element(page.getByText(translate("authRequest.signIn.accessDenied", { client: "Wiki" }))).toBeVisible();
			await expect.element(page.getByLabelText(t.signIn.password, { exact: true })).toHaveValue("");

			server.on({ [`POST ${BASE}/sign-in`]: apiError(401, "sign_in_failed") });
			await signIn();
			await expect.element(page.getByText(MESSAGES.en.errors.sign_in_failed)).toBeVisible();

			server.on({ [`POST ${BASE}/sign-in`]: apiError(400, "validation_failed", [{ path: "email", code: "email_invalid" }]) });
			await signIn();
			await expect.element(page.getByText(MESSAGES.en.validation.email_invalid)).toBeVisible();
		});

		it("ends on the error page when the request expires meanwhile", async () => {
			await openRequest(signInPrompt(), { [`POST ${BASE}/sign-in`]: apiError(410, "auth_request_expired") });

			await signIn();

			await expect.element(page.getByRole("heading", { name: t.expired.title })).toBeVisible();
		});

		it("cancels the request and returns to the application", async () => {
			const server = await openRequest(signInPrompt(), { [`POST ${BASE}/cancel`]: { body: REDIRECT } });

			await page.getByRole("button", { name: t.cancel }).click();

			expect(server.calls(`POST ${BASE}/cancel`)).toHaveLength(1);
			expect(loadPage).toHaveBeenCalledWith(REDIRECT.redirectTo);
		});

		it("shows a failed cancellation as an error", async () => {
			await openRequest(signInPrompt(), { [`POST ${BASE}/cancel`]: apiError(410, "auth_request_invalid") });

			await page.getByRole("button", { name: t.cancel }).click();

			await expect.element(page.getByRole("heading", { name: t.expired.title })).toBeVisible();
		});

		it("disables the form while the cancellation runs", async () => {
			await openRequest(signInPrompt(), { [`POST ${BASE}/cancel`]: "pending" });

			await page.getByRole("button", { name: t.cancel }).click();

			await expect.element(page.getByRole("button", { name: t.signIn.submit })).toBeDisabled();
		});
	});

	describe("second factor", () => {
		it("asks for the code after the password and continues", async () => {
			const server = await openRequest(signInPrompt(), {
				[`POST ${BASE}/sign-in`]: { body: secondFactorPrompt() },
				[`POST ${BASE}/second-factor`]: { body: REDIRECT },
			});

			await signIn();
			await expect
				.element(page.getByText(translate("authRequest.signIn.redirectNotice", { origin: "https://wiki.example.com" })))
				.toBeVisible();
			await page.getByLabelText(tTwoFactor.codeLabel).fill("123456");

			expect(server.calls(`POST ${BASE}/second-factor`)[0]?.body).toEqual({ code: "123456" });
			await vi.waitFor(() => expect(loadPage).toHaveBeenCalledWith(REDIRECT.redirectTo));
		});

		it("goes back to the password, also with a message when the second step expired", async () => {
			await openRequest(signInPrompt(), {
				[`POST ${BASE}/sign-in`]: { body: secondFactorPrompt() },
				[`POST ${BASE}/second-factor`]: apiError(401, "second_factor_expired"),
			});

			await signIn();
			await page.getByRole("button", { name: tTwoFactor.notYou }).click();
			await expect.element(page.getByLabelText(t.signIn.password, { exact: true })).toHaveValue("");

			await signIn();
			await page.getByLabelText(tTwoFactor.codeLabel).fill("123456");
			await expect.element(page.getByText(tTwoFactor.expired)).toBeVisible();
		});

		it("ends on the error page when the request expires at the second step", async () => {
			await openRequest(signInPrompt(), {
				[`POST ${BASE}/sign-in`]: { body: secondFactorPrompt() },
				[`POST ${BASE}/second-factor`]: apiError(410, "auth_request_expired"),
			});

			await signIn();
			await page.getByLabelText(tTwoFactor.codeLabel).fill("123456");

			await expect.element(page.getByRole("heading", { name: t.expired.title })).toBeVisible();
		});

		it("cancels the request from the second step", async () => {
			await openRequest(signInPrompt(), {
				[`POST ${BASE}/sign-in`]: { body: secondFactorPrompt() },
				[`POST ${BASE}/cancel`]: "pending",
			});

			await signIn();
			await page.getByRole("button", { name: t.cancel }).click();

			await expect.element(page.getByRole("button", { name: new RegExp(t.cancel) })).toBeDisabled();
		});

		it("confirms a step-up the application asks for without the password", async () => {
			const stepUp = { ...secondFactorPrompt(), challenge: "challenge-1", instanceName: "Example SSO", client: authRequestClient() };
			const server = await openRequest(stepUp, {
				[`POST ${BASE}/second-factor`]: apiError(400, "second_factor_invalid"),
				[`POST ${BASE}/cancel`]: { body: REDIRECT },
			});

			await expect.element(page.getByRole("button", { name: tTwoFactor.notYou })).not.toBeInTheDocument();
			await expect.element(page.getByText(/You will continue to https:\/\/wiki.example.com/)).toBeVisible();
			await page.getByLabelText(tTwoFactor.codeLabel).fill("111111");
			await expect.element(page.getByText(tTwoFactor.invalidCode)).toBeVisible();

			server.on({ [`POST ${BASE}/second-factor`]: apiError(401, "second_factor_expired") });
			await page.getByLabelText(tTwoFactor.codeLabel).fill("222222");
			await vi.waitFor(() => expect(reloadPage).toHaveBeenCalledOnce());

			await page.getByRole("button", { name: t.cancel }).click();
			expect(loadPage).toHaveBeenCalledWith(REDIRECT.redirectTo);
		});

		it("shows a step-up without a redirect notice", async () => {
			const stepUp = {
				...secondFactorPrompt(),
				challenge: "challenge-1",
				instanceName: "Example SSO",
				client: authRequestClient({ redirectOrigin: null }),
			};
			await openRequest(stepUp);

			await expect.element(page.getByText(tTwoFactor.totpDescription)).toBeVisible();
			await expect.element(page.getByText(/You will continue to/)).not.toBeInTheDocument();
		});
	});

	describe("consent", () => {
		it("asks to allow access and continues", async () => {
			const server = await openRequest(consentPrompt({ scopes: ["openid", "profile", "email"] }), {
				[`POST ${BASE}/consent`]: { body: REDIRECT },
			});

			await expect.element(page.getByRole("heading", { name: "Wiki wants to access your account" })).toBeVisible();
			await expect.element(page.getByText("The team wiki")).toBeVisible();
			await expect.element(page.getByText("ada@example.com")).toBeVisible();
			await expect.element(page.getByText(MESSAGES.en.scopes.email.title)).toBeVisible();
			await expect.element(page.getByText(MESSAGES.en.scopes.profile.description)).toBeVisible();
			await expect
				.element(page.getByText(translate("authRequest.consent.redirectNotice", { origin: "https://wiki.example.com" })))
				.toBeVisible();
			await page.getByRole("button", { name: t.consent.allow }).click();

			expect(server.calls(`POST ${BASE}/consent`)).toHaveLength(1);
			expect(loadPage).toHaveBeenCalledWith(REDIRECT.redirectTo);
		});

		it("denies access and returns to the application", async () => {
			await openRequest(consentPrompt({ client: authRequestClient({ description: "", redirectOrigin: null }) }), {
				[`POST ${BASE}/cancel`]: { body: REDIRECT },
			});

			await expect.element(page.getByText("The team wiki")).not.toBeInTheDocument();
			await page.getByRole("button", { name: t.consent.deny }).click();

			expect(loadPage).toHaveBeenCalledWith(REDIRECT.redirectTo);
		});

		it("blocks both buttons while the approval runs", async () => {
			await openRequest(consentPrompt(), { [`POST ${BASE}/consent`]: "pending" });

			await page.getByRole("button", { name: t.consent.allow }).click();

			await expect.element(page.getByRole("button", { name: t.consent.deny })).toBeDisabled();
		});

		it("blocks both buttons while the denial runs", async () => {
			await openRequest(consentPrompt(), { [`POST ${BASE}/cancel`]: "pending" });

			await page.getByRole("button", { name: t.consent.deny }).click();

			await expect.element(page.getByRole("button", { name: t.consent.allow })).toBeDisabled();
		});

		it("ends on the error page when the approval fails", async () => {
			await openRequest(consentPrompt(), { [`POST ${BASE}/consent`]: apiError(410, "auth_request_expired") });

			await page.getByRole("button", { name: t.consent.allow }).click();

			await expect.element(page.getByRole("heading", { name: t.expired.title })).toBeVisible();
		});
	});
});
