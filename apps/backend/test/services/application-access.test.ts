import type { OidcClientRecord, UserRecord } from "@aegis/db";
import { describe, expect, it, vi } from "vitest";
import type { ClientAssignmentRepository } from "../../src/repositories/client-assignments.js";
import type { ClientRepository } from "../../src/repositories/clients.js";
import type { UserRepository } from "../../src/repositories/users.js";
import { ApplicationAccess } from "../../src/services/application-access.js";

// A role table in which `user` may not sign in to applications, as a future role might not.
vi.mock(import("@aegis/contracts"), async (importOriginal) => {
	const contracts = await importOriginal();
	return {
		...contracts,
		hasPermission: (role, permission) =>
			role === "user" && permission === "applications:sign_in" ? false : contracts.hasPermission(role, permission),
	};
});

describe("ApplicationAccess", () => {
	it("keeps a role without applications:sign_in out of every application, even when assigned", async () => {
		const client = { id: "2", accessPolicy: "everyone" } as OidcClientRecord;
		const user = { id: "1", role: "user" } as UserRecord;
		const assignments = { exists: vi.fn(async () => true), listClientIds: async () => ["2"] };
		const access = new ApplicationAccess({
			users: {} as UserRepository,
			clients: { list: async () => [client] } as unknown as ClientRepository,
			assignments: assignments as unknown as ClientAssignmentRepository,
		});

		expect(await access.allows(user, client)).toBe(false);
		expect(await access.applicationsOf(user)).toEqual([{ client, assigned: true, canSignIn: false }]);
		expect(assignments.exists).not.toHaveBeenCalled();
	});
});
