import { describe, expect, it } from "vitest";
import { AppAvatar } from "@/components/app-avatar";
import { pickBy } from "@/lib/arrays";
import { renderUi } from "../../support/render";

describe("AppAvatar", () => {
	it("shows the logo or a monogram in a color derived from the name", async () => {
		const screen = await renderUi(
			<>
				<AppAvatar name="Team Wiki" size="xl" />
				<AppAvatar name="Grafana" size="xs" />
				<AppAvatar name="" size="lg" />
				<AppAvatar name="Docs" src="/api/media/logos/1/abc.webp" />
			</>,
		);

		await expect.element(screen.getByText("TW")).toBeInTheDocument();
		await expect.element(screen.getByText("G", { exact: true })).toBeInTheDocument();
		await expect.element(screen.getByText("?")).toBeInTheDocument();
		const monogram = screen.getByText("TW").element();
		expect(monogram.className).toMatch(/from-\w+-\d+ to-\w+-\d+/);
	});

	it("picks the same gradient for the same name", () => {
		expect(pickBy(["a", "b", "c"], 4)).toBe("b");
		expect(pickBy(["a", "b", "c"], -1)).toBe("a");
		expect(pickBy(["a", "b", "c"], 1.5)).toBe("a");
	});
});
