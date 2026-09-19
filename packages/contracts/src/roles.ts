/**
 * Roles from least to most privileged; each role may do everything the previous one may. A `user`
 * signs in to applications, an `admin` also manages Aegis.
 */
export const ROLES = ["user", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** Everything an account can be allowed to do, as `resource:action`. */
export const PERMISSIONS = [
	/** Sign in to applications, within the access policy of each application. */
	"applications:sign_in",
	/** Use the administration: its dashboard and the own account. */
	"console:access",
	"users:read",
	"users:manage",
	"applications:read",
	"applications:manage",
	"sessions:read",
	"sessions:manage",
	"audit:read",
	"settings:read",
	"settings:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Users may only sign in to applications; admins may do everything. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
	user: ["applications:sign_in"],
	admin: PERMISSIONS,
};

export function hasPermission(role: Role, permission: Permission): boolean {
	return ROLE_PERMISSIONS[role].includes(permission);
}
