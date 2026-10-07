import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { SecondFactorStep } from "@/components/two-factor/second-factor-step";
import { ApiRequestError } from "@/lib/api";
import { secondFactorPrompt } from "../../../support/fixtures";
import { MESSAGES, renderUi } from "../../../support/render";

const t = MESSAGES.en.twoFactor.signIn;

const rejection = (code: ConstructorParameters<typeof ApiRequestError>[1]) => new ApiRequestError(400, code, code);
const codeInput = () => page.getByLabelText(t.codeLabel);
const recoveryInput = () => page.getByLabelText(t.recoveryLabel);
const form = () => document.querySelector("form") as HTMLFormElement;

describe("SecondFactorStep", () => {
	it("confirms the code from the authenticator app as soon as it is complete", async () => {
		const onSubmit = vi.fn(() => new Promise<void>(() => {}));
		await renderUi(<SecondFactorStep prompt={secondFactorPrompt()} brandName="Example SSO" onSubmit={onSubmit} />);

		await expect.element(page.getByText("ada@example.com")).toBeVisible();
		await expect.element(page.getByText(t.totpDescription)).toBeVisible();
		await expect.element(page.getByRole("button", { name: t.notYou })).not.toBeInTheDocument();
		await codeInput().fill("123456");

		expect(onSubmit).toHaveBeenCalledExactlyOnceWith("123456");
		await expect.element(page.getByRole("button", { name: new RegExp(t.submit) })).toBeDisabled();
		// While it is confirmed, neither the button nor the form start another attempt.
		form().requestSubmit();
		expect(onSubmit).toHaveBeenCalledOnce();
	});

	it("explains a wrong code and lets the user try again", async () => {
		const onSubmit = vi.fn().mockRejectedValueOnce(rejection("second_factor_invalid")).mockRejectedValueOnce(rejection("rate_limited"));
		await renderUi(<SecondFactorStep prompt={secondFactorPrompt()} onSubmit={onSubmit} />);

		await codeInput().fill("111111");
		await expect.element(page.getByText(t.invalidCode)).toBeVisible();
		await expect.element(codeInput()).toHaveValue("");
		await expect.element(codeInput()).toHaveFocus();

		await codeInput().fill("2");
		await expect.element(page.getByText(t.invalidCode)).not.toBeInTheDocument();
		await userEvent.type(codeInput(), "22222");
		await expect.element(page.getByText(MESSAGES.en.errors.rate_limited)).toBeVisible();
	});

	it("takes a recovery code instead and switches back", async () => {
		const onSubmit = vi.fn().mockRejectedValueOnce(rejection("validation_failed")).mockResolvedValue(undefined);
		await renderUi(
			<SecondFactorStep prompt={secondFactorPrompt()} onSubmit={onSubmit} secondaryAction={<a href="/cancel">Cancel</a>} />,
		);

		await page.getByRole("button", { name: t.useRecoveryCode }).click();
		await expect.element(page.getByText(t.recoveryDescription)).toBeVisible();
		await expect.element(page.getByRole("link", { name: "Cancel" })).toBeVisible();
		const submit = page.getByRole("button", { name: new RegExp(t.submit) });
		await expect.element(submit).toBeDisabled();
		form().requestSubmit();
		expect(onSubmit).not.toHaveBeenCalled();

		await recoveryInput().fill("K7PQM-3XHVT");
		await submit.click();
		await expect.element(page.getByText(t.invalidRecoveryCode)).toBeVisible();
		await recoveryInput().fill("K7PQM-3XHVA");
		await expect.element(page.getByText(t.invalidRecoveryCode)).not.toBeInTheDocument();

		await page.getByRole("button", { name: t.useAuthenticator }).click();
		await expect.element(codeInput()).toHaveValue("");
		await page.getByRole("button", { name: t.useRecoveryCode }).click();
		await expect.element(recoveryInput()).toHaveValue("");
		await recoveryInput().fill("K7PQM-3XHVA");
		await submit.click();
		expect(onSubmit).toHaveBeenLastCalledWith("K7PQM-3XHVA");
	});

	it("starts over when the sign-in expired or for another account", async () => {
		const onRestart = vi.fn();
		const onSubmit = vi.fn().mockRejectedValue(rejection("second_factor_expired"));
		await renderUi(<SecondFactorStep prompt={secondFactorPrompt()} onSubmit={onSubmit} onRestart={onRestart} footer={<p>Footer</p>} />);

		await expect.element(page.getByText("Footer")).toBeVisible();
		await page.getByRole("button", { name: t.notYou }).click();
		expect(onRestart).toHaveBeenLastCalledWith();

		await codeInput().fill("123456");
		await vi.waitFor(() => expect(onRestart).toHaveBeenLastCalledWith(t.expired));
	});

	it("offers no other account when the caller rules it out", async () => {
		await renderUi(<SecondFactorStep prompt={secondFactorPrompt()} onSubmit={vi.fn()} onRestart={vi.fn()} canSwitchAccount={false} />);

		await expect.element(page.getByText(t.totpDescription)).toBeVisible();
		await expect.element(page.getByRole("button", { name: t.notYou })).not.toBeInTheDocument();
	});

	it("reports an expired sign-in like any other error without a way back", async () => {
		const onSubmit = vi.fn().mockRejectedValue(rejection("second_factor_expired"));
		await renderUi(<SecondFactorStep prompt={secondFactorPrompt()} onSubmit={onSubmit} />);

		await codeInput().fill("123456");

		await expect.element(page.getByText(MESSAGES.en.errors.second_factor_expired)).toBeVisible();
	});
});
