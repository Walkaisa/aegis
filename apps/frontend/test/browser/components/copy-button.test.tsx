import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { CopyButton, CopyField } from "@/components/copy-button";
import { MESSAGES, renderUi } from "../../support/render";

describe("CopyButton", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("copies the value and confirms it for two seconds", async () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
		await renderUi(<CopyButton value="client-123" />);

		await page.getByRole("button", { name: "Copy" }).click();

		expect(writeText).toHaveBeenCalledWith("client-123");
		await expect.element(page.getByRole("button", { name: "Copied" })).toBeVisible();

		await vi.advanceTimersByTimeAsync(2000);
		await expect.element(page.getByRole("button", { name: "Copy" })).toBeVisible();
	});

	it("uses a custom label until the value is copied", async () => {
		vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
		await renderUi(<CopyButton value="x" label="Copy secret" size="icon-xs" />);

		await page.getByRole("button", { name: "Copy secret" }).click();

		await expect.element(page.getByRole("button", { name: "Copied" })).toBeVisible();
	});

	it("reports when the clipboard is not available", async () => {
		vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
		await renderUi(<CopyButton value="x" />);

		await page.getByRole("button", { name: "Copy" }).click();

		await expect.element(page.getByText(MESSAGES.en.common.copyFailed)).toBeVisible();
		await expect.element(page.getByRole("button", { name: "Copy" })).toBeVisible();
	});
});

describe("CopyField", () => {
	it("shows the value read-only, selects it on focus and copies it", async () => {
		const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
		await renderUi(<CopyField id="secret" value="s3cr3t" />);

		const input = page.getByRole("textbox");
		await expect.element(input).toHaveValue("s3cr3t");
		await expect.element(input).toHaveAttribute("readonly");
		await expect.element(input).toHaveClass(/font-mono/);

		await input.click();
		const element = input.element() as HTMLInputElement;
		expect([element.selectionStart, element.selectionEnd]).toEqual([0, 6]);

		await page.getByRole("button", { name: "Copy" }).click();
		expect(writeText).toHaveBeenCalledWith("s3cr3t");
		await expect.element(page.getByRole("button", { name: "Copied" })).toBeVisible();
	});

	it("can show the value in the regular font", async () => {
		await renderUi(<CopyField value="https://aegis.example" mono={false} />);

		await expect.element(page.getByRole("textbox")).not.toHaveClass(/font-mono/);
	});
});
