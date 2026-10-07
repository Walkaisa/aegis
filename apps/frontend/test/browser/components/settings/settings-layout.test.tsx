import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { setLocation } from "../../../support/next/navigation";
import { MESSAGES, renderUi } from "../../../support/render";

const t = MESSAGES.en.settings;

describe("SettingsLayout", () => {
	it("links the settings pages", async () => {
		setLocation("/settings/email");
		await renderUi(<SettingsLayout>content</SettingsLayout>);

		await expect.element(page.getByRole("link", { name: t.tabs.email })).toHaveAttribute("aria-current", "page");
		await expect.element(page.getByText("content")).toBeVisible();
	});
});
