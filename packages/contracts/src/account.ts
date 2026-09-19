import { z } from "zod";
import { displayNameSchema, emailSchema, existingPasswordSchema, newPasswordSchema } from "./identity";
import type { UserDto } from "./users";

/** Changing the e-mail address requires the current password; the display name does not. */
export const profileUpdateSchema = z.object({
	displayName: displayNameSchema,
	email: emailSchema,
	currentPassword: z.string().max(4096, { error: "too_long" }).optional(),
});

export type ProfileUpdateRequest = z.infer<typeof profileUpdateSchema>;

export const passwordChangeSchema = z.object({
	currentPassword: existingPasswordSchema,
	newPassword: newPasswordSchema,
});

export type PasswordChangeRequest = z.infer<typeof passwordChangeSchema>;

/** The signed-in admin's own account. */
export interface AccountResponse {
	account: UserDto;
}
