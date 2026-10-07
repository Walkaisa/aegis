import { describe, expect, it, vi } from "vitest";
import { CodeBlock } from "@/components/code-block";
import { MESSAGES, renderUi } from "../../support/render";

const t = MESSAGES.en;

describe("CodeBlock", () => {
	it("shows a file with its code and copies it", async () => {
		const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
		const screen = await renderUi(<CodeBlock file=".env" code="OIDC_ISSUER=https://auth.example.com" />);

		await expect.element(screen.getByText(".env")).toBeVisible();
		await screen.getByRole("button", { name: t.common.copy }).click();

		expect(writeText).toHaveBeenCalledWith("OIDC_ISSUER=https://auth.example.com");
	});
});
