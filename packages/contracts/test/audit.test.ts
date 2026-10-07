import { describe, expect, it } from "vitest";
import {
	AUDIT_CATEGORIES,
	AUDIT_DEFAULT_PAGE_SIZE,
	AUDIT_EVENT_TYPES,
	AUDIT_EVENTS,
	auditCategoryOf,
	auditEventTypesIn,
	auditOutcomeOf,
	auditQuerySchema,
	auditSeverityOf,
	auditSpecOf,
	auditTargetTypeOf,
	maxAuditSeverity,
} from "../src/audit";

describe("audit event catalogue", () => {
	it("derives every category from the dotted prefix of the event type", () => {
		for (const type of AUDIT_EVENT_TYPES) {
			expect(AUDIT_CATEGORIES).toContain(auditCategoryOf(type));
			expect(auditSpecOf(type)).toBe(AUDIT_EVENTS[type]);
			expect(auditTargetTypeOf(type)).toBe(AUDIT_EVENTS[type].target);
			expect(auditOutcomeOf(type)).toBe(AUDIT_EVENTS[type].outcome);
		}
	});

	it("records failures with a failure outcome", () => {
		const failures = AUDIT_EVENT_TYPES.filter((type) => /failed|denied/.test(type));
		expect(failures.length).toBeGreaterThan(0);
		for (const type of failures) {
			expect(auditOutcomeOf(type)).toBe("failure");
		}
	});
});

describe("auditSeverityOf", () => {
	it("keeps the baseline of ordinary events", () => {
		expect(auditSeverityOf("auth.sign_in.failed")).toBe("warning");
		expect(auditSeverityOf("auth.sign_in.failed", { reason: "invalid_credentials" })).toBe("warning");
		expect(auditSeverityOf("auth.sign_in.succeeded", null)).toBe("info");
		expect(auditSeverityOf("client.deleted", { reason: "throttled" })).toBe("warning");
	});

	it("escalates throttled sign-ins and recovery code sign-ins", () => {
		expect(auditSeverityOf("auth.sign_in.failed", { reason: "throttled" })).toBe("error");
		expect(auditSeverityOf("auth.sign_in.succeeded", { secondFactor: "recovery_code" })).toBe("notice");
		expect(auditSeverityOf("auth.sign_in.succeeded", { secondFactor: "totp" })).toBe("info");
	});

	it("never lowers a severity", () => {
		expect(maxAuditSeverity("critical", "info")).toBe("critical");
		expect(maxAuditSeverity("info", "error")).toBe("error");
		expect(maxAuditSeverity("notice", "notice")).toBe("notice");
	});
});

describe("auditEventTypesIn", () => {
	it("lists the event types of the given categories", () => {
		const email = auditEventTypesIn(["email"]);
		expect(email.length).toBeGreaterThan(0);
		expect(email.every((type) => type.startsWith("email."))).toBe(true);
		expect(auditEventTypesIn([])).toEqual([]);
		expect(auditEventTypesIn(AUDIT_CATEGORIES)).toEqual(AUDIT_EVENT_TYPES);
	});
});

describe("auditQuerySchema", () => {
	it("applies the defaults", () => {
		expect(auditQuerySchema.parse({})).toEqual({
			page: 1,
			perPage: AUDIT_DEFAULT_PAGE_SIZE,
			categories: [],
			severities: [],
			outcomes: [],
			sources: [],
			from: null,
			to: null,
			search: "",
			order: "newest",
		});
	});

	it("parses query strings and comma-separated lists", () => {
		expect(
			auditQuerySchema.parse({
				page: "3",
				perPage: "50",
				categories: "users,email,",
				severities: ["warning"],
				outcomes: "failure",
				sources: "admin",
				from: "2026-01-01T00:00:00Z",
				to: "2026-02-01T00:00:00+01:00",
				search: "  ada  ",
				order: "oldest",
			}),
		).toMatchObject({
			page: 3,
			perPage: 50,
			categories: ["users", "email"],
			severities: ["warning"],
			outcomes: ["failure"],
			sources: ["admin"],
			search: "ada",
			order: "oldest",
		});
	});

	it("rejects values outside the allowed ranges", () => {
		const codes = (input: Record<string, unknown>) => auditQuerySchema.safeParse(input).error?.issues.map((issue) => issue.message);
		expect(codes({ page: "0" })).toEqual(["out_of_range"]);
		expect(codes({ perPage: "201" })).toEqual(["out_of_range"]);
		expect(codes({ page: "x" })).toEqual(["invalid"]);
		expect(codes({ categories: "nope" })).toEqual(["invalid"]);
		expect(codes({ from: "yesterday" })).toEqual(["invalid"]);
		expect(codes({ search: "x".repeat(201) })).toEqual(["too_long"]);
		expect(codes({ order: "random" })).toEqual(["invalid"]);
	});
});
