import { z } from "zod";
import type { IsoDateString } from "./common";
import { instanceNameSchema } from "./identity";

export const SESSION_TTL_DAYS_MIN = 1;
export const SESSION_TTL_DAYS_MAX = 90;

export const AUDIT_RETENTION_DAYS_MIN = 1;
export const AUDIT_RETENTION_DAYS_MAX = 3650;

/** Retention presets offered in the audit log. */
export const AUDIT_RETENTION_OPTIONS = [7, 30, 90, 180, 365] as const;

export const instanceSettingsSchema = z.object({
	instanceName: instanceNameSchema,
	sessionTtlDays: z
		.number({ error: "invalid" })
		.int({ error: "invalid" })
		.min(SESSION_TTL_DAYS_MIN, { error: "out_of_range" })
		.max(SESSION_TTL_DAYS_MAX, { error: "out_of_range" }),
	auditRetentionDays: z
		.number({ error: "invalid" })
		.int({ error: "invalid" })
		.min(AUDIT_RETENTION_DAYS_MIN, { error: "out_of_range" })
		.max(AUDIT_RETENTION_DAYS_MAX, { error: "out_of_range" }),
});

export type InstanceSettingsRequest = z.infer<typeof instanceSettingsSchema>;

/** Changes any subset of the settings, e.g. only the audit retention from the audit log. */
export const instanceSettingsUpdateSchema = instanceSettingsSchema.partial();

export type InstanceSettingsUpdateRequest = z.infer<typeof instanceSettingsUpdateSchema>;

export interface InstanceSettingsDto {
	instanceName: string;
	sessionTtlDays: number;
	auditRetentionDays: number;
	issuer: string;
	setupCompletedAt: IsoDateString;
}

export interface SigningKeyDto {
	kid: string;
	alg: string;
	status: "active" | "retired";
	createdAt: IsoDateString;
	retiredAt: IsoDateString | null;
}

export interface SecurityOverviewDto {
	signingKeys: SigningKeyDto[];
	/** How long retired keys stay published in the JWKS so issued tokens remain verifiable. */
	retiredKeyRetentionDays: number;
	argon2: {
		memoryKiB: number;
		iterations: number;
		parallelism: number;
	};
}
