import { z } from "zod";
import { displayNameSchema, emailSchema, instanceNameSchema, newPasswordSchema } from "./identity";

export interface InstanceInfo {
	setupRequired: boolean;
	instanceName: string | null;
	issuer: string;
	version: string;
	/** Whether the sign-in page offers a password reset; requires a working e-mail server. */
	passwordResetEnabled: boolean;
}

/** Creates the initial admin account. Only possible once. */
export const setupRequestSchema = z.object({
	instanceName: instanceNameSchema,
	displayName: displayNameSchema,
	email: emailSchema,
	password: newPasswordSchema,
});

export type SetupRequest = z.infer<typeof setupRequestSchema>;
