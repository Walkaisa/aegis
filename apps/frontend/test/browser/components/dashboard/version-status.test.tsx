import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { useVersionStatus, VersionStatusProvider } from "@/components/dashboard/version-status";
import { mockApi } from "../../../support/api";
import { me, versionStatus } from "../../../support/fixtures";
import { renderUi } from "../../../support/render";

describe("VersionStatusProvider", () => {
	function Status() {
		const { status, check } = useVersionStatus();
		return (
			<button type="button" onClick={() => void check()}>
				{status?.latest?.version ?? "unknown"}
			</button>
		);
	}

	it("checks for new releases on request and every ten minutes", async () => {
		vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
		try {
			const server = mockApi({
				"GET /api/settings/updates": { body: versionStatus() },
				"POST /api/settings/updates/check": {
					body: versionStatus({ latest: { version: "1.4.0", url: "u", publishedAt: "2026-01-01T00:00:00Z" } }),
				},
			});
			await renderUi(
				<VersionStatusProvider>
					<Status />
				</VersionStatusProvider>,
				{ me: me() },
			);
			await expect.element(page.getByRole("button", { name: "1.2.0" })).toBeVisible();

			vi.advanceTimersByTime(10 * 60 * 1000);
			await expect.poll(() => server.calls("GET /api/settings/updates").length).toBeGreaterThan(1);
			await page.getByRole("button", { name: "1.2.0" }).click();
			await expect.element(page.getByRole("button", { name: "1.4.0" })).toBeVisible();
		} finally {
			vi.useRealTimers();
		}
	});

	it("stays silent for accounts that may not read the settings", async () => {
		await renderUi(
			<VersionStatusProvider>
				<Status />
			</VersionStatusProvider>,
			{ me: me({ role: "user" }) },
		);

		await expect.element(page.getByRole("button", { name: "unknown" })).toBeVisible();
	});

	it("is required by useVersionStatus", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		function Version() {
			useVersionStatus();
			return null;
		}

		await expect(render(<Version />)).rejects.toThrow("useVersionStatus must be used within VersionStatusProvider");
	});
});
