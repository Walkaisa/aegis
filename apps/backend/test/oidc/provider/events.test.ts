import type Provider from "oidc-provider";
import { describe, expect, vi } from "vitest";
import { ADMIN, type TestAegis, test } from "../../support/aegis.js";
import { auditEvents, awaitAuditEvent } from "../../support/audit.js";
import { createApplication } from "../../support/oidc.js";
import { providerContext } from "../../support/oidc-provider.js";

describe("provider events", () => {
	async function provider(aegis: TestAegis): Promise<Provider> {
		await aegis.setup();
		return aegis.services.oidc.requireProvider();
	}

	test("record a sign-in the request tells little about", async ({ aegis }) => {
		(await provider(aegis)).emit("authorization.success", providerContext({ oidc: {} }));

		expect(await awaitAuditEvent(aegis, "oidc.authorization.succeeded")).toMatchObject({
			actor: null,
			subject: null,
			client: null,
			ipAddress: null,
			userAgent: null,
		});
	});

	test("record the account of a sign-in without an Aegis session", async ({ aegis }) => {
		const events = await provider(aegis);
		const admin = await aegis.signIn(ADMIN.email, ADMIN.password);
		const application = await createApplication(admin);
		const user = await aegis.createUser();

		events.emit(
			"authorization.success",
			providerContext({
				oidc: { client: { clientId: application.id }, session: { accountId: user.id } },
				headers: { "user-agent": "x".repeat(600) },
			}),
		);

		const event = await awaitAuditEvent(aegis, "oidc.authorization.succeeded");
		expect(event).toMatchObject({ actor: { id: user.id }, client: { id: application.id } });
		expect(event.userAgent).toHaveLength(512);
		expect((await admin.get(`/api/applications/${application.id}`)).json().client.lastAuthorizedAt).not.toBeNull();
		expect(await aegis.services.sessions.listByClient(application.id, new Date())).toEqual([]);
	});

	test("record errors without a request or an application", async ({ aegis }) => {
		const events = await provider(aegis);

		events.emit("authorization.error", providerContext(), new Error("broken"));
		events.emit("grant.error", providerContext(), new Error("broken"));

		expect((await awaitAuditEvent(aegis, "oidc.authorization.failed")).metadata).toEqual({
			error: "Error",
			description: null,
			clientId: null,
			redirectUri: null,
		});
		expect(await awaitAuditEvent(aegis, "oidc.token.failed")).toMatchObject({
			client: null,
			metadata: { error: "Error", description: null, grantType: null },
		});
	});

	test("ignore a declined sign-out without a session", async ({ aegis }) => {
		const events = await provider(aegis);
		const log = vi.spyOn(aegis.app.log, "error");

		events.emit("end_session.success", providerContext({ oidc: { params: {} } }));

		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(log).not.toHaveBeenCalled();
		expect(await auditEvents(aegis, "oidc.sign_out")).toEqual([]);
	});

	test("log bookkeeping that fails", async ({ aegis }) => {
		const events = await provider(aegis);
		const log = vi.spyOn(aegis.app.log, "error");
		vi.spyOn(aegis.services.audit, "record").mockRejectedValue(new Error("database down"));

		events.emit("authorization.success", providerContext({ oidc: {} }));
		events.emit("grant.error", providerContext({ oidc: { params: {} } }), new Error("broken"));
		events.emit("end_session.success", providerContext({ oidc: { params: { logout: "yes" } } }));

		await vi.waitFor(() => {
			expect(log.mock.calls.map(([, message]) => message)).toEqual(
				expect.arrayContaining([
					"Failed to record an application sign-in",
					"Failed to record a token error",
					"Failed to process a sign-out",
				]),
			);
		});
	});
});
