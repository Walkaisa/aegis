import { sessions } from "@aegis/db";
import { describe, expect, vi } from "vitest";
import { newId } from "../../src/lib/snowflakes.js";
import { DAY_MS } from "../../src/lib/time.js";
import { startMaintenance } from "../../src/services/maintenance.js";
import { type TestAegis, test } from "../support/aegis.js";
import { auditEvents } from "../support/audit.js";

const ago = (ms: number) => new Date(Date.now() - ms);

/** One expired item of every kind the maintenance run removes. */
async function seedExpired(aegis: TestAegis) {
	const { services } = aegis;
	const user = await aegis.createUser();
	await services.auth.createSession(user, { ip: null, userAgent: null });
	await services.database.db
		.update(sessions)
		.set({ createdAt: ago(3_000), authenticatedAt: ago(3_000), lastSeenAt: ago(3_000), expiresAt: ago(1_000) });
	await services.oidcArtifacts.upsert("AccessToken", "expired", { accountId: user.id }, ago(1_000));
	await services.audit.record({ type: "settings.updated" }, ago(400 * DAY_MS));
	await services.accountTokens.insert({
		id: newId(),
		userId: user.id,
		purpose: "password_reset",
		tokenHash: "hash",
		targetEmail: null,
		targetEmailNormalized: null,
		expiresAt: ago(1_000),
		createdAt: ago(2_000),
	});
}

describe("startMaintenance", () => {
	test("removes expired data and rebuilds the provider once retired keys are gone", async ({ aegis }) => {
		await aegis.setup();
		await seedExpired(aegis);
		await aegis.services.keyService.rotateSigningKey(ago(8 * DAY_MS));
		const debug = vi.spyOn(aegis.app.log, "debug");
		const reload = vi.spyOn(aegis.services.oidc, "reload");

		const stop = startMaintenance(aegis.services, aegis.app.log);
		await vi.waitFor(() => expect(debug).toHaveBeenCalled());
		stop();

		expect(debug).toHaveBeenCalledWith(
			{ sessions: 2, oidcArtifacts: 1, auditEvents: 1, signingKeys: 1, accountTokens: 1 },
			"Removed expired data",
		);
		expect(reload).toHaveBeenCalledOnce();
		expect((await aegis.services.keys.listSigningKeys()).map((key) => key.status)).toEqual(["active"]);
	});

	test("keeps quiet when there is nothing to remove", async ({ aegis }) => {
		await aegis.setup();
		const debug = vi.spyOn(aegis.app.log, "debug");
		const deleteExpired = vi.spyOn(aegis.services.accountTokens, "deleteExpired");

		const stop = startMaintenance(aegis.services, aegis.app.log);
		await vi.waitFor(() => expect(deleteExpired).toHaveBeenCalled());
		stop();

		expect(debug).not.toHaveBeenCalled();
	});

	test("keeps the audit log for the configured days before the setup", async ({ aegis }) => {
		await aegis.services.audit.record({ type: "settings.updated" }, ago((aegis.config.auditRetentionDays + 1) * DAY_MS));
		await aegis.services.audit.record({ type: "settings.updated" }, ago((aegis.config.auditRetentionDays - 1) * DAY_MS));
		const deleteOlderThan = vi.spyOn(aegis.services.audit, "deleteOlderThan");

		const stop = startMaintenance(aegis.services, aegis.app.log);
		await vi.waitFor(() => expect(deleteOlderThan).toHaveResolved());
		stop();

		expect(await auditEvents(aegis, "settings.updated")).toHaveLength(1);
	});

	test("runs every fifteen minutes, one run at a time, and logs failures", async ({ aegis }) => {
		vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
		try {
			const error = vi.spyOn(aegis.app.log, "error");
			const sweep = vi.spyOn(aegis.services.throttle, "sweep");
			let finishFirst = () => {};
			const deleteExpired = vi
				.spyOn(aegis.services.sessions, "deleteExpired")
				.mockImplementationOnce(() => new Promise<number>((resolve) => (finishFirst = () => resolve(0))))
				.mockRejectedValueOnce(new Error("database down"));

			const stop = startMaintenance(aegis.services, aegis.app.log);
			vi.advanceTimersByTime(15 * 60_000);
			expect(deleteExpired).toHaveBeenCalledOnce();

			finishFirst();
			await vi.waitFor(() => expect(sweep).toHaveBeenCalledOnce());
			vi.advanceTimersByTime(15 * 60_000);
			await vi.waitFor(() =>
				expect(error).toHaveBeenCalledWith(
					{ err: expect.objectContaining({ message: "database down" }) },
					"Maintenance run failed",
				),
			);
			stop();
		} finally {
			vi.useRealTimers();
		}
	});
});
