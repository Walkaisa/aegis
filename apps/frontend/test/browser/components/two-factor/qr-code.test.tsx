import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { QrCode } from "@/components/two-factor/qr-code";

describe("QrCode", () => {
	it("draws the value as an accessible SVG with a quiet zone", async () => {
		const { container } = await render(<QrCode value="otpauth://totp/Aegis:ada" label="QR code" />);

		await expect.element(page.getByRole("img", { name: "QR code" })).toBeVisible();
		const svg = container.querySelector("svg");
		// Version 2 at level M has 25 modules; two on every side keep scanners happy.
		expect(svg?.getAttribute("viewBox")).toBe("0 0 29 29");
		expect(svg?.querySelector("path")?.getAttribute("d")).toMatch(/^M2 2h1v1h-1z/);
	});
});
