import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { RecoveryCodeList } from "@/components/two-factor/recovery-code-list";
import { RECOVERY_CODES } from "../../../support/fixtures";
import { MESSAGES, renderUi } from "../../../support/render";

const t = MESSAGES.en;

/** Captures the file a download link hands to the browser instead of saving it. */
function captureDownload() {
	const blobs: Blob[] = [];
	vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
		blobs.push(blob as Blob);
		return "blob:recovery-codes";
	});
	const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
	const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
	return { blobs, revoke, click };
}

describe("RecoveryCodeList", () => {
	it("lists the codes and copies them line by line", async () => {
		const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
		await renderUi(<RecoveryCodeList codes={RECOVERY_CODES} accountName="ada@example.com" instanceName="Example SSO" />);

		expect(page.getByRole("listitem").elements()).toHaveLength(10);
		await page.getByRole("button", { name: t.twoFactor.recoveryCodes.copy }).click();

		expect(writeText).toHaveBeenCalledWith(RECOVERY_CODES.join("\n"));
		await expect.element(page.getByRole("button", { name: t.common.copied })).toBeVisible();
		// The confirmation goes away by itself.
		await expect.element(page.getByRole("button", { name: t.twoFactor.recoveryCodes.copy }), { timeout: 3000 }).toBeVisible();
	});

	it("says when the clipboard refuses the codes", async () => {
		vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
		await renderUi(<RecoveryCodeList codes={RECOVERY_CODES} accountName="ada@example.com" instanceName="Example SSO" />);

		await page.getByRole("button", { name: t.twoFactor.recoveryCodes.copy }).click();

		await expect.element(page.getByText(t.common.copyFailed)).toBeVisible();
	});

	it("downloads the codes as a text file named after the instance", async () => {
		const { blobs, revoke, click } = captureDownload();
		await renderUi(<RecoveryCodeList codes={RECOVERY_CODES} accountName="ada@example.com" instanceName="Example SSO" />);

		await page.getByRole("button", { name: t.twoFactor.recoveryCodes.download }).click();

		const link = click.mock.contexts[0] as HTMLAnchorElement;
		expect(link.download).toBe("example-sso-recovery-codes.txt");
		const text = await blobs[0]?.text();
		expect(text).toContain("Recovery codes for Example SSO");
		expect(text).toContain("Account: ada@example.com");
		expect(text).toContain(`Address: ${window.location.origin}`);
		expect(text).toContain(" 1. K7PQM-00000");
		expect(text).toContain("10. K7PQM-00009");
		expect(revoke).toHaveBeenCalledWith("blob:recovery-codes");
	});

	it("falls back to a generic file name", async () => {
		const { click } = captureDownload();
		await renderUi(<RecoveryCodeList codes={RECOVERY_CODES} accountName="ada@example.com" instanceName="" />);

		await page.getByRole("button", { name: t.twoFactor.recoveryCodes.download }).click();

		expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe("aegis-recovery-codes.txt");
	});
});
