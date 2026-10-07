import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { MIGRATIONS_FOLDER } from "../src/client";
import * as schema from "../src/schema/index";

const tables = Object.values<unknown>(schema).filter((value): value is PgTable => is(value, PgTable));

/** `<table>.<column> -> <table>.<column> (on delete …)` for every foreign key. */
function foreignKeys() {
	return tables.flatMap((table) => {
		const config = getTableConfig(table);
		return config.foreignKeys.map((key) => {
			const reference = key.reference();
			const target = getTableConfig(reference.foreignTable);
			return `${config.name}.${reference.columns.map((column) => column.name).join(",")} -> ${target.name}.${reference.foreignColumns.map((column) => column.name).join(",")} (${key.onDelete})`;
		});
	});
}

describe("schema", () => {
	it("defines every table with its constraints", () => {
		const names = tables.map((table) => getTableConfig(table).name).sort();
		expect(names).toEqual([
			"account_tokens",
			"audit_events",
			"client_assignments",
			"client_logos",
			"cookie_keys",
			"email_settings",
			"oidc_artifacts",
			"oidc_clients",
			"oidc_consents",
			"recovery_codes",
			"session_applications",
			"sessions",
			"signing_keys",
			"system_settings",
			"user_avatars",
			"users",
		]);
		for (const table of tables) {
			const config = getTableConfig(table);
			for (const column of config.columns) {
				expect(column.getSQLType()).toBeTruthy();
			}
			expect([...config.checks, ...config.indexes, ...config.uniqueConstraints, ...config.primaryKeys]).toBeDefined();
		}
	});

	it("removes everything that belongs to a deleted account or application, but keeps the audit log", () => {
		expect(foreignKeys().sort()).toEqual([
			"account_tokens.user_id -> users.id (cascade)",
			"audit_events.actor_user_id -> users.id (set null)",
			"audit_events.client_id -> oidc_clients.id (set null)",
			"audit_events.subject_user_id -> users.id (set null)",
			"client_assignments.client_id -> oidc_clients.id (cascade)",
			"client_assignments.user_id -> users.id (cascade)",
			"client_logos.client_id -> oidc_clients.id (cascade)",
			"oidc_consents.client_id -> oidc_clients.id (cascade)",
			"oidc_consents.user_id -> users.id (cascade)",
			"recovery_codes.user_id -> users.id (cascade)",
			"session_applications.client_id -> oidc_clients.id (cascade)",
			"session_applications.session_id -> sessions.id (cascade)",
			"sessions.user_id -> users.id (cascade)",
			"user_avatars.user_id -> users.id (cascade)",
		]);
	});

	it("stores snowflakes as bigint and hands them out as strings", () => {
		const id = getTableConfig(schema.users).columns.find((column) => column.name === "id");
		expect(id?.getSQLType()).toBe("bigint");
		expect(id?.mapFromDriverValue(123n)).toBe("123");
	});

	it("ships its migrations next to the compiled package", () => {
		expect(MIGRATIONS_FOLDER.replaceAll("\\", "/")).toMatch(/packages\/db\/migrations$/);
	});
});
