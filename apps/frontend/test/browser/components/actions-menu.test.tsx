import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { ActionsMenu, CopyMenuItem } from "@/components/actions-menu";
import { MESSAGES, renderUi } from "../../support/render";

const t = MESSAGES.en;

describe("ActionsMenu", () => {
	it("copies a value from the menu and confirms it", async () => {
		const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
		await renderUi(
			<ActionsMenu>
				<CopyMenuItem value="3220506287531888640" label="Copy ID" copiedMessage="ID copied" />
			</ActionsMenu>,
		);

		await page.getByRole("button", { name: t.common.moreActions }).click();
		await page.getByRole("menuitem", { name: "Copy ID" }).click();

		expect(writeText).toHaveBeenCalledWith("3220506287531888640");
		await expect.element(page.getByText("ID copied")).toBeVisible();
	});

	it("reports a clipboard that refuses", async () => {
		vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
		await renderUi(
			<ActionsMenu>
				<CopyMenuItem value="x" label="Copy ID" copiedMessage="ID copied" />
			</ActionsMenu>,
		);

		await page.getByRole("button", { name: t.common.moreActions }).click();
		await page.getByRole("menuitem", { name: "Copy ID" }).click();

		await expect.element(page.getByText(t.common.copyFailed)).toBeVisible();
	});
});
