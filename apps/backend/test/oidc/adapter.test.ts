import { describe, expect } from "vitest";
import { createAdapterFactory } from "../../src/oidc/adapter.js";
import { test } from "../support/aegis.js";
import { createApplication } from "../support/oidc.js";

describe("artifact adapter", () => {
	test("stores, finds, consumes and removes provider artifacts", async ({ aegis }) => {
		const adapter = createAdapterFactory(aegis.services)("DeviceCode");

		await adapter.upsert("code", { uid: "uid-1", userCode: "ABCD-EFGH", grantId: "grant-1" }, 60);
		await adapter.upsert("forever", { uid: "uid-2" });

		expect(await adapter.find("code")).toEqual({ uid: "uid-1", userCode: "ABCD-EFGH", grantId: "grant-1" });
		expect(await adapter.findByUid("uid-2")).toEqual({ uid: "uid-2" });
		expect(await adapter.findByUserCode("ABCD-EFGH")).toMatchObject({ uid: "uid-1" });
		expect(await adapter.find("missing")).toBeUndefined();

		await adapter.consume("code");
		expect((await adapter.find("code"))?.consumed).toEqual(expect.any(Number));

		await adapter.revokeByGrantId("grant-1");
		expect(await adapter.find("code")).toBeUndefined();
		await adapter.destroy("forever");
		expect(await adapter.findByUid("uid-2")).toBeUndefined();
	});

	test("forgets expired artifacts", async ({ aegis }) => {
		const adapter = createAdapterFactory(aegis.services)("Interaction");

		await aegis.services.oidcArtifacts.upsert("Interaction", "old", { uid: "old" }, new Date(Date.now() - 1_000));

		expect(await adapter.find("old")).toBeUndefined();
		expect(adapter).toBeDefined();
	});
});

describe("client adapter", () => {
	test("reads enabled applications only, with their secret", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const adapter = createAdapterFactory(aegis.services)("Client");

		expect(await adapter.find(application.id)).toMatchObject({
			client_id: application.id,
			client_secret: application.secret,
			token_endpoint_auth_method: "client_secret_basic",
			grant_types: ["authorization_code"],
			response_types: ["code"],
		});
		expect(await adapter.find("1")).toBeUndefined();

		await aegis.services.clients.update(application.id, { enabled: false }, new Date());
		expect(await adapter.find(application.id)).toBeUndefined();
	});

	test("never lets the provider change applications", async ({ aegis }) => {
		const adapter = createAdapterFactory(aegis.services)("Client");

		await expect(adapter.upsert("1", {}, 60)).rejects.toThrow("cannot be written");
		await expect(adapter.destroy("1")).rejects.toThrow("cannot be deleted");
		expect(await adapter.findByUid("1")).toBeUndefined();
		expect(await adapter.findByUserCode("1")).toBeUndefined();
		await expect(adapter.consume("1")).resolves.toBeUndefined();
		await expect(adapter.revokeByGrantId("1")).resolves.toBeUndefined();
	});
});
