import { AEGIS_REPOSITORY, AEGIS_REPOSITORY_URL, type ReleaseDto, type VersionStatusDto } from "@aegis/contracts";
import type { FastifyBaseLogger } from "fastify";
import semver from "semver";
import { z } from "zod";
import { MINUTE_MS, SECOND_MS, toIsoOrNull } from "../lib/time.js";

const LATEST_RELEASE_URL = `https://api.github.com/repos/${AEGIS_REPOSITORY}/releases/latest`;
/** The version of GitHub's REST API the response below is read with. */
const GITHUB_API_VERSION = "2026-03-10";

const CHECK_INTERVAL_MS = 10 * MINUTE_MS;
/** Restarts in quick succession, a crash loop or `pnpm dev`, don't each ask GitHub. */
const FIRST_CHECK_DELAY_MS = MINUTE_MS;
const REQUEST_TIMEOUT_MS = 10 * SECOND_MS;

/** The part of GitHub's release object that is used. The endpoint never returns drafts or pre-releases. */
const latestReleaseSchema = z.object({
	tag_name: z.string(),
	published_at: z.iso.datetime(),
});

export interface UpdateCheckerDependencies {
	currentVersion: string;
	enabled: boolean;
	log: FastifyBaseLogger;
}

/**
 * Looks for new releases of Aegis on GitHub, shortly after the start and then every ten minutes. The
 * request carries nothing about the instance except the version in its User-Agent. Repeated checks
 * send the ETag of the last answer, so an unchanged release comes back as an empty `304`. Six checks
 * an hour stay far below the 60 requests an hour GitHub allows without a token. The result lives in
 * memory only; a restart simply checks again.
 */
export class UpdateChecker {
	private readonly deps: UpdateCheckerDependencies;
	private latest: ReleaseDto | null = null;
	private checkedAt: Date | null = null;
	private failed = false;
	private etag: string | null = null;
	private pending: Promise<void> | null = null;

	public constructor(deps: UpdateCheckerDependencies) {
		this.deps = deps;
	}

	public status(): VersionStatusDto {
		const { currentVersion, enabled } = this.deps;
		return {
			current: currentVersion,
			checkEnabled: enabled,
			latest: this.latest,
			updateAvailable: this.latest !== null && semver.gt(this.latest.version, currentVersion),
			checkedAt: toIsoOrNull(this.checkedAt),
			checkFailed: this.failed,
		};
	}

	/** Asks GitHub right away; concurrent callers share one request. */
	public async check(): Promise<VersionStatusDto> {
		if (this.deps.enabled) {
			this.pending ??= this.fetchLatest().finally(() => {
				this.pending = null;
			});
			await this.pending;
		}
		return this.status();
	}

	/** Schedules the periodic checks. Returns a function that stops them. */
	public start(): () => void {
		if (!this.deps.enabled) {
			return () => {};
		}

		let interval: NodeJS.Timeout | undefined;
		const first = setTimeout(() => {
			void this.check();
			interval = setInterval(() => void this.check(), CHECK_INTERVAL_MS);
			interval.unref();
		}, FIRST_CHECK_DELAY_MS);
		first.unref();

		return () => {
			clearTimeout(first);
			clearInterval(interval);
		};
	}

	private async fetchLatest(): Promise<void> {
		const { currentVersion, log } = this.deps;
		const headers: Record<string, string> = {
			accept: "application/vnd.github+json",
			"user-agent": `Aegis/${currentVersion}`,
			"x-github-api-version": GITHUB_API_VERSION,
		};
		if (this.etag) {
			headers["if-none-match"] = this.etag;
		}

		try {
			const response = await fetch(LATEST_RELEASE_URL, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
			if (response.status === 304 && this.latest) {
				this.markChecked();
				return;
			}
			if (!response.ok) {
				throw new Error(`GitHub answered ${response.status} ${response.statusText}`);
			}

			const release = latestReleaseSchema.parse(await response.json());
			const version = semver.clean(release.tag_name);
			if (!version) {
				throw new Error(`The latest release is tagged "${release.tag_name}", which is not a version`);
			}

			this.latest = {
				version,
				url: `${AEGIS_REPOSITORY_URL}/releases/tag/${encodeURIComponent(release.tag_name)}`,
				publishedAt: release.published_at,
			};
			this.etag = response.headers.get("etag");
			this.markChecked();

			if (semver.gt(version, currentVersion)) {
				log.info({ current: currentVersion, latest: version }, `Aegis ${version} is available: ${this.latest.url}`);
			}
		} catch (error) {
			this.failed = true;
			log.warn({ err: error }, "Could not look for new Aegis releases");
		}
	}

	private markChecked(): void {
		this.checkedAt = new Date();
		this.failed = false;
	}
}
