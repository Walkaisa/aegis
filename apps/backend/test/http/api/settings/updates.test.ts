import { describe, expect, vi } from "vitest";
import { startAegis, test } from "../../../support/aegis.js";

describe("/api/settings/updates", () => {
	test("reports the running version without asking GitHub while the check is off", async ({ aegis }) => {
		const admin = await aegis.setup();
		const fetch = vi.spyOn(globalThis, "fetch");

		const status = (await admin.post("/api/settings/updates/check")).json();

		expect(status).toEqual({
			current: aegis.config.version,
			checkEnabled: false,
			latest: null,
			updateAvailable: false,
			checkedAt: null,
			checkFailed: false,
		});
		expect((await admin.get("/api/settings/updates")).json()).toEqual(status);
		expect(fetch).not.toHaveBeenCalled();
	});

	test("asks GitHub on request", async () => {
		const aegis = await startAegis({ env: { AEGIS_UPDATE_CHECK: "true" } });
		try {
			const admin = await aegis.setup();
			vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
				Response.json({ tag_name: "v99.0.0", published_at: "2026-09-01T12:00:00Z" }),
			);

			const status = (await admin.post("/api/settings/updates/check")).json();

			expect(status).toMatchObject({
				checkEnabled: true,
				updateAvailable: true,
				latest: { version: "99.0.0" },
				checkedAt: expect.any(String),
			});
			const user = await aegis.sessionFor(await aegis.createUser());
			expect((await user.post("/api/settings/updates/check")).statusCode).toBe(403);
		} finally {
			await aegis.close();
		}
	});
});
