import { z } from "zod";
import { displayNameSchema, emailSchema, instanceNameSchema, newPasswordSchema } from "./identity";

export interface InstanceInfo {
	setupRequired: boolean;
	instanceName: string | null;
	issuer: string;
	version: string;
}

/** Creates the initial admin account. Only possible once. */
export const setupRequestSchema = z.object({
	instanceName: instanceNameSchema,
	displayName: displayNameSchema,
	email: emailSchema,
	password: newPasswordSchema,
});

export type SetupRequest = z.infer<typeof setupRequestSchema>;
