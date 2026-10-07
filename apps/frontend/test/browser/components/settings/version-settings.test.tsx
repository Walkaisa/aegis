import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { VersionStatusProvider } from "@/components/dashboard/version-status";
import { VersionSettings } from "@/components/settings/version-settings";
import { apiError, mockApi } from "../../../support/api";
import { me, NOW, versionStatus } from "../../../support/fixtures";
import { MESSAGES, renderUi, translate } from "../../../support/render";

const t = MESSAGES.en.settings;

describe("VersionSettings", () => {
	function renderVersion(admin = me()) {
		return renderUi(
			<VersionStatusProvider>
				<VersionSettings />
			</VersionStatusProvider>,
			{ me: admin },
		);
	}

	it("compares the running version with the newest release and points to the update", async () => {
		const newer = versionStatus({
			updateAvailable: true,
			latest: { version: "1.3.0", url: "https://github.com/Walkaisa/aegis/releases/tag/v1.3.0", publishedAt: NOW },
		});
		mockApi({ "GET /api/settings/updates": { body: newer } });
		await renderVersion();

		await expect.element(page.getByText(translate("settings.updateAvailableTitle", { version: "1.3.0" }))).toBeVisible();
		await expect.element(page.getByText(t.updateAvailable)).toBeVisible();
		await expect.element(page.getByRole("link", { name: t.viewRelease })).toHaveAttribute("href", newer.latest?.url);
		await expect
			.element(page.getByRole("link", { name: t.releaseNotes }))
			.toHaveAttribute("href", "https://github.com/Walkaisa/aegis/releases/tag/v1.2.0");
	});

	it("checks on request and tells what it found", async () => {
		const server = mockApi({
			"GET /api/settings/updates": { body: versionStatus({ checkedAt: null, latest: null }) },
			"POST /api/settings/updates/check": { body: versionStatus() },
		});
		await renderVersion();

		await expect.element(page.getByText(t.notCheckedYet)).toBeVisible();
		await expect.element(page.getByText(t.updateCheckPending)).toBeVisible();
		await expect.element(page.getByText(t.latestUnknown)).toBeVisible();

		await page.getByRole("button", { name: t.checkForUpdates }).click();
		await expect.element(page.getByText(t.upToDateToast)).toBeVisible();
		await expect.element(page.getByText(t.upToDate)).toBeVisible();

		server.on({
			"POST /api/settings/updates/check": {
				body: versionStatus({ updateAvailable: true, latest: { version: "1.3.0", url: "u", publishedAt: NOW } }),
			},
		});
		await page.getByRole("button", { name: t.checkForUpdates }).click();
		await expect.element(page.getByText(translate("settings.updateFound", { version: "1.3.0" }))).toBeVisible();

		server.on({ "POST /api/settings/updates/check": { body: versionStatus({ checkFailed: true }) } });
		await page.getByRole("button", { name: t.checkForUpdates }).click();
		await expect.element(page.getByText(t.updateCheckError)).toBeVisible();
		await expect.element(page.getByText(/^The last check failed/)).toBeVisible();

		server.on({ "POST /api/settings/updates/check": apiError(429, "rate_limited") });
		await page.getByRole("button", { name: t.checkForUpdates }).click();
		await expect.element(page.getByText(MESSAGES.en.errors.rate_limited)).toBeVisible();
	});

	it("says when the check is turned off or has never succeeded", async () => {
		const server = mockApi({
			"GET /api/settings/updates": { body: versionStatus({ checkEnabled: false, latest: null, checkedAt: null }) },
		});
		await renderVersion();

		await expect.element(page.getByText(t.updateCheckOff)).toBeVisible();
		await expect.element(page.getByText(t.versionDescriptionOff)).toBeVisible();
		await expect.element(page.getByText(t.updateCheckDisabled)).toBeVisible();
		await expect.element(page.getByRole("button", { name: t.checkForUpdates })).not.toBeInTheDocument();
		expect(server.calls("GET /api/settings/updates")).not.toHaveLength(0);
	});

	it("reports a check that never succeeded and lets only managers check", async () => {
		mockApi({ "GET /api/settings/updates": { body: versionStatus({ checkFailed: true, checkedAt: null }) } });
		await renderVersion({ ...me(), permissions: ["console:access", "settings:read"] });

		await expect.element(page.getByText(t.updateCheckFailed)).toBeVisible();
		await expect.element(page.getByRole("button", { name: t.checkForUpdates })).not.toBeInTheDocument();
	});

	it("offers a retry when the status cannot be loaded", async () => {
		const server = mockApi({ "GET /api/settings/updates": apiError(500, "internal_error") });
		await renderVersion();

		await expect.element(page.getByText(MESSAGES.en.common.loadFailed)).toBeVisible();
		server.on({ "GET /api/settings/updates": { body: versionStatus() } });
		await page.getByRole("button", { name: MESSAGES.en.common.retry }).click();
		await expect.element(page.getByText(t.upToDate)).toBeVisible();
	});
});
