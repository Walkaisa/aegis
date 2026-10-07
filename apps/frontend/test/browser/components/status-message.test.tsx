import { Sparkles } from "lucide-react";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { STATUS_TONES, StatusMessage } from "@/components/status-message";
import { renderUi } from "../../support/render";

describe("StatusMessage", () => {
	it.each(STATUS_TONES)("announces the %s tone with the matching role", async (tone) => {
		await renderUi(<StatusMessage tone={tone} title="Title" />);

		const message = page.getByRole(tone === "error" ? "alert" : "status");
		await expect.element(message).toHaveAttribute("data-tone", tone);
		await expect.element(message).toHaveTextContent("Title");
	});

	it("shows the body, the actions and a custom icon", async () => {
		await renderUi(
			<StatusMessage title="Saved" icon={<Sparkles data-testid="custom-icon" />} action={<button type="button">Undo</button>}>
				Everything is up to date.
			</StatusMessage>,
		);

		await expect.element(page.getByText("Everything is up to date.")).toBeVisible();
		await expect.element(page.getByRole("button", { name: "Undo" })).toBeVisible();
		await expect.element(page.getByTestId("custom-icon")).toBeInTheDocument();
	});

	it("renders only what it is given", async () => {
		const screen = await renderUi(<StatusMessage />);

		const message = screen.getByRole("status");
		await expect.element(message).toHaveAttribute("data-tone", "info");
		expect(message.element().querySelectorAll("p")).toHaveLength(0);
	});
});
