import type { IsoDateString } from "./common";
import type { Role } from "./roles";
import type { Snowflake } from "./snowflakes";

export interface SessionApplicationDto {
	id: Snowflake;
	name: string;
	logoUrl: string | null;
	lastAuthorizedAt: IsoDateString;
}

export interface SessionAccountDto {
	id: Snowflake;
	displayName: string;
	email: string;
	role: Role;
	avatarUrl: string | null;
}

/** An Aegis browser session, the account it belongs to and the applications it signed in to. */
export interface SessionDto {
	id: Snowflake;
	/** True for the session making the request. */
	current: boolean;
	account: SessionAccountDto;
	authenticatedAt: IsoDateString;
	/** The sign-in was confirmed with a second factor. */
	secondFactor: boolean;
	lastSeenAt: IsoDateString;
	expiresAt: IsoDateString;
	ipAddress: string | null;
	userAgent: string | null;
	applications: SessionApplicationDto[];
}

export interface SessionListResponse {
	sessions: SessionDto[];
}

/** Returned after ending all sessions of an account. */
export interface SessionRevocationResponse {
	/** How many sessions were ended. */
	revoked: number;
}
