import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { DangerZone, Section, SectionHeader } from "@/components/dashboard/page";
import { StatCard } from "@/components/dashboard/stat-card";
import { ErrorState } from "@/components/dashboard/states";
import { user } from "../../../support/fixtures";
import { MESSAGES, Providers, renderUi } from "../../../support/render";

const t = MESSAGES.en;

describe("page building blocks", () => {
	it("render only the parts they are given", async () => {
		await renderUi(
			<>
				<SectionHeader title="Plain" />
				<Section>untitled</Section>
				<Section title="Titled" footer={<span>footer</span>}>
					body
				</Section>
				<DangerZone title="Danger" description="Careful" action={<button type="button">Delete</button>}>
					hint
				</DangerZone>
				<StatCard label="Failed" value={3} icon={<span />} tone="danger" />
				<StatCard label="Loading" value={null} icon={<span />} />
				<ErrorState error={new Error("x")} />
			</>,
		);

		await expect.element(page.getByRole("heading", { name: "Plain" })).toBeVisible();
		await expect.element(page.getByText("footer")).toBeVisible();
		await expect.element(page.getByText("3", { exact: true })).toHaveClass(/text-destructive/);
		await expect.element(page.getByRole("button", { name: t.common.retry })).not.toBeInTheDocument();
		await userEvent.keyboard("{Escape}");
	});

	it("work in German as well", async () => {
		await render(
			<Providers locale="de">
				<SectionHeader title="Titel" description="Beschreibung" />
			</Providers>,
		);

		await expect.element(page.getByText("Beschreibung")).toBeVisible();
		expect(user().displayName).toBe("Ada Lovelace");
	});
});
