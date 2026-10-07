import { describe, expect } from "vitest";
import { ADMIN, type TestAegis, test } from "../../support/aegis.js";
import { testImage } from "../../support/images.js";
import { createApplication } from "../../support/oidc.js";

const at = (iso: string) => new Date(iso);

/** A small log: one event per source, outcome and severity that the filters below pick apart. */
async function seed(aegis: TestAegis, admin: Awaited<ReturnType<TestAegis["setup"]>>) {
	const { audit } = aegis.services;
	const adminId = (await admin.get("/api/auth/session")).json().account.id as string;
	const application = await createApplication(admin, { name: "Wiki_100%" });
	await audit.deleteOlderThan(new Date());
	const meta = { ip: "203.0.113.7", userAgent: "Firefox" };
	await audit.record(
		{ type: "auth.sign_in.succeeded", actor: { id: adminId, label: "ada@aegis.test" }, meta, metadata: { context: "admin" } },
		at("2026-01-01T10:00:00Z"),
	);
	await audit.record(
		{
			type: "auth.sign_in.failed",
			source: "user",
			meta: { ip: "198.51.100.1", userAgent: null },
			metadata: { reason: "invalid_password" },
		},
		at("2026-01-02T10:00:00Z"),
	);
	await audit.record(
		{ type: "client.created", actor: { id: adminId, label: "ada@aegis.test" }, client: { id: application.id, label: "Wiki_100%" } },
		at("2026-01-03T10:00:00Z"),
	);
	await audit.record({ type: "settings.updated", actor: { id: adminId, label: "ada@aegis.test" } }, at("2026-01-04T10:00:00Z"));
}

async function types(admin: Awaited<ReturnType<TestAegis["setup"]>>, query: string): Promise<string[]> {
	const response = await admin.get(`/api/audit/events?${query}`);
	expect(response.statusCode, response.body).toBe(200);
	return response.json().events.map((event: { type: string }) => event.type);
}

describe("GET /api/audit/events", () => {
	test("pages through the log, newest or oldest first", async ({ aegis }) => {
		const admin = await aegis.setup();
		await seed(aegis, admin);

		const first = (await admin.get("/api/audit/events?perPage=2")).json();
		expect(first).toMatchObject({ total: 4, page: 1, perPage: 2 });
		expect(first.events.map((event: { type: string }) => event.type)).toEqual(["settings.updated", "client.created"]);
		expect(await types(admin, "perPage=2&page=2")).toEqual(["auth.sign_in.failed", "auth.sign_in.succeeded"]);
		expect(await types(admin, "order=oldest&perPage=1")).toEqual(["auth.sign_in.succeeded"]);
	});

	test("filters by category, severity, outcome, source and time", async ({ aegis }) => {
		const admin = await aegis.setup();
		await seed(aegis, admin);

		expect(await types(admin, "categories=applications,system")).toEqual(["settings.updated", "client.created"]);
		expect(await types(admin, "outcomes=failure")).toEqual(["auth.sign_in.failed"]);
		expect(await types(admin, "severities=warning")).toEqual(["auth.sign_in.failed"]);
		expect(await types(admin, "sources=admin&categories=authentication")).toEqual(["auth.sign_in.succeeded"]);
		expect(await types(admin, "from=2026-01-02T00:00:00Z&to=2026-01-03T23:59:59Z")).toEqual(["client.created", "auth.sign_in.failed"]);
	});

	test("searches labels, types and addresses literally", async ({ aegis }) => {
		const admin = await aegis.setup();
		await seed(aegis, admin);

		expect(await types(admin, "search=198.51")).toEqual(["auth.sign_in.failed"]);
		expect(await types(admin, `search=${encodeURIComponent("Wiki_100%")}`)).toEqual(["client.created"]);
		expect(await types(admin, "search=100%25%25")).toEqual([]);
		expect(await types(admin, "search=settings")).toEqual(["settings.updated"]);
		expect(await types(admin, "search=a_a")).toEqual([]);
	});

	test("shows the current names and pictures of what events refer to", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		await admin.request("PUT", `/api/applications/${application.id}/logo`, {
			headers: { "content-type": "image/png" },
			payload: await testImage(),
		});
		await admin.put(`/api/applications/${application.id}`, {
			name: "Handbook",
			description: "",
			tokenEndpointAuthMethod: "client_secret_basic",
			redirectUris: [application.redirectUri],
			postLogoutRedirectUris: [],
			allowedScopes: ["openid"],
			skipConsent: false,
			enabled: true,
			accessPolicy: "everyone",
			pkcePolicy: "optional",
		});

		const [event] = (await admin.get("/api/audit/events?search=client.created")).json().events;

		expect(event.actor).toMatchObject({ label: ADMIN.email, name: ADMIN.displayName, role: "admin", imageUrl: null });
		expect(event.client).toMatchObject({
			id: application.id,
			label: "Wiki",
			name: "Handbook",
			role: null,
			imageUrl: expect.stringMatching(/^\/api\/media\/logos\//),
		});
		expect(event.subject).toBeNull();
	});

	test("keeps references to what no longer exists", async ({ aegis }) => {
		const admin = await aegis.setup();
		const gone = await aegis.createUser({ email: "gone@aegis.test" });
		const application = await createApplication(admin, { name: "Old" });
		await aegis.services.audit.record({
			type: "user.updated",
			actor: { id: gone.id, label: gone.email },
			subject: { id: gone.id, label: gone.email },
		});
		await admin.delete(`/api/users/${gone.id}`);
		await admin.delete(`/api/applications/${application.id}`);

		const [updated] = (await admin.get("/api/audit/events?search=user.updated")).json().events;
		const [deleted] = (await admin.get("/api/audit/events?search=client.deleted")).json().events;

		expect(updated.actor).toEqual({ id: null, label: "gone@aegis.test", name: null, role: null, imageUrl: null });
		expect(deleted.client).toEqual({ id: null, label: "Old", name: null, role: null, imageUrl: null });
	});

	test("rejects invalid filters and is reserved for admins", async ({ aegis }) => {
		const admin = await aegis.setup();
		const user = await aegis.sessionFor(await aegis.createUser());

		expect((await admin.get("/api/audit/events?perPage=500")).json().error.issues).toEqual([{ path: "perPage", code: "out_of_range" }]);
		expect((await admin.get("/api/audit/events?categories=unknown")).statusCode).toBe(400);
		expect((await user.get("/api/audit/events")).statusCode).toBe(403);
		expect((await user.get("/api/audit/summary")).statusCode).toBe(403);
	});
});

describe("GET /api/audit/summary", () => {
	test("counts the matches per severity and spans the whole log", async ({ aegis }) => {
		const admin = await aegis.setup();
		await seed(aegis, admin);

		const summary = (await admin.get("/api/audit/summary?categories=authentication")).json();

		expect(summary).toEqual({
			total: 2,
			bySeverity: { info: 1, notice: 0, warning: 1, error: 0, critical: 0 },
			oldestAt: "2026-01-01T10:00:00.000Z",
			newestAt: "2026-01-04T10:00:00.000Z",
			retentionDays: aegis.config.auditRetentionDays,
		});
	});

	test("is empty for an empty log", async ({ aegis }) => {
		const admin = await aegis.setup();
		await aegis.services.audit.deleteOlderThan(new Date(Date.now() + 60_000));

		const summary = (await admin.get("/api/audit/summary")).json();

		expect(summary).toMatchObject({ total: 0, oldestAt: null, newestAt: null });
	});
});
