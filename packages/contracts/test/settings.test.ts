import { describe, expect, it } from "vitest";
import { instanceSettingsSchema, instanceSettingsUpdateSchema } from "../src/settings";
import { issueCodes } from "./support/issues";

describe("instanceSettingsSchema", () => {
	it("keeps the instance settings within range", () => {
		expect(instanceSettingsSchema.safeParse({ instanceName: "Aegis", sessionTtlDays: 30, auditRetentionDays: 180 }).success).toBe(true);
		expect(issueCodes(instanceSettingsSchema, { instanceName: "Aegis", sessionTtlDays: 91, auditRetentionDays: 0 })).toEqual([
			"out_of_range",
			"out_of_range",
		]);
		expect(instanceSettingsUpdateSchema.parse({ auditRetentionDays: 7 })).toEqual({ auditRetentionDays: 7 });
	});
});
