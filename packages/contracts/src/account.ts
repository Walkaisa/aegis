import { z } from "zod";
import { displayNameSchema, emailSchema, existingPasswordSchema, newPasswordSchema } from "./identity";
import type { PendingEmailChangeDto } from "./recovery";
import type { UserDto } from "./users";

/**
 * Changing the e-mail address requires the current password; the display name does not.
 *
 * With an e-mail server configured, a new address is not applied right away: it is confirmed from
 * the new mailbox first (`pendingEmailChange` in the response). Without one it takes effect at once.
 */
export const profileUpdateSchema = z.object({
	displayName: displayNameSchema,
	email: emailSchema,
	currentPassword: existingPasswordSchema.optional(),
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
	/** An e-mail change waiting to be confirmed from the new address, if there is one. */
	pendingEmailChange: PendingEmailChangeDto | null;
}
