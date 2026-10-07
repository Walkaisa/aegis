import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { UnsavedChangesBar } from "@/components/unsaved-changes-bar";
import { MESSAGES, renderUi } from "../../support/render";

const t = MESSAGES.en;

describe("UnsavedChangesBar", () => {
	it("discards or saves, and waits while saving", async () => {
		const onDiscard = vi.fn();
		const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
		const { rerender } = await renderUi(
			<form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
				<UnsavedChangesBar saving={false} hint="Applies to new sessions" onDiscard={onDiscard} />
			</form>,
		);

		await expect.element(page.getByText("Applies to new sessions")).toBeVisible();
		await page.getByRole("button", { name: t.common.discard }).click();
		await page.getByRole("button", { name: t.common.saveChanges }).click();
		expect(onDiscard).toHaveBeenCalledOnce();
		expect(onSubmit).toHaveBeenCalledOnce();

		await rerender(
			<form>
				<UnsavedChangesBar saving onDiscard={onDiscard} />
			</form>,
		);
		await expect.element(page.getByRole("button", { name: new RegExp(t.common.saveChanges) })).toBeDisabled();
		await expect.element(page.getByRole("button", { name: t.common.discard })).toBeDisabled();
		await expect.element(page.getByRole("status", { name: "Loading" })).toBeVisible();
	});
});
