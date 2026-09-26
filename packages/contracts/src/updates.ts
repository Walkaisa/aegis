import type { IsoDateString } from "./common";

/** Where Aegis is developed and released, as `owner/name` on GitHub. */
export const AEGIS_REPOSITORY = "Walkaisa/aegis";

export const AEGIS_REPOSITORY_URL = `https://github.com/${AEGIS_REPOSITORY}`;

/** A published release of Aegis. */
export interface ReleaseDto {
	version: string;
	/** Its release notes on GitHub. */
	url: string;
	publishedAt: IsoDateString;
}

/**
 * The running version next to the newest release. Aegis looks for new releases on its own unless
 * `AEGIS_UPDATE_CHECK` turns that off.
 */
export interface VersionStatusDto {
	current: string;
	/** Whether Aegis looks for new releases. */
	checkEnabled: boolean;
	/** The newest release; `null` until a check has succeeded. */
	latest: ReleaseDto | null;
	updateAvailable: boolean;
	/** When GitHub last answered. */
	checkedAt: IsoDateString | null;
	/** Whether the most recent check failed; `latest` then still holds the last known release. */
	checkFailed: boolean;
}
