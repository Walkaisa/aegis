import type { AuditEventDto } from "./audit";
import type { IsoDateString } from "./common";
import type { Snowflake } from "./snowflakes";

/** Sign-ins of one UTC day, to Aegis itself and to applications. */
export interface OverviewActivityDay {
	/** `YYYY-MM-DD` */
	date: string;
	succeeded: number;
	failed: number;
}

export interface OverviewApplicationUsage {
	/** `null` once the application has been deleted. */
	id: Snowflake | null;
	name: string;
	logoUrl: string | null;
	authorizations: number;
}

export interface OverviewDto {
	instanceName: string;
	generatedAt: IsoDateString;
	stats: {
		applications: number;
		/** Accounts of type `user`. */
		users: number;
		admins: number;
		activeSessions: number;
		signIns24h: number;
		failedSignIns24h: number;
	};
	/** The last 14 days, oldest first. */
	activity: OverviewActivityDay[];
	/** Most used applications of the last 30 days. */
	topApplications: OverviewApplicationUsage[];
	recentEvents: AuditEventDto[];
}
