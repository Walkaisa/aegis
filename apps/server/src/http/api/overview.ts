import { applicationLogoUrl, type OverviewActivityDay, type OverviewDto } from "@aegis/contracts";
import type { FastifyInstance } from "fastify";
import { DAY_MS } from "../../lib/time.js";
import { access } from "../access.js";
import { requireSettings } from "../request-context.js";

const ACTIVITY_DAYS = 14;

/** The last `days` UTC days as `YYYY-MM-DD`, oldest first. */
function dayKeys(now: Date, days: number): string[] {
	const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	return Array.from({ length: days }, (_, index) => new Date(today - (days - 1 - index) * DAY_MS).toISOString().slice(0, 10));
}

/** `/api/overview`: key figures, sign-in activity and recent events of the dashboard. */
export async function overviewRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;

	app.get("/", access("console:access"), async (): Promise<OverviewDto> => {
		const settings = requireSettings(services);
		const now = new Date();
		const dayAgo = new Date(now.getTime() - DAY_MS);
		const days = dayKeys(now, ACTIVITY_DAYS);
		const activitySince = new Date(`${days[0]}T00:00:00.000Z`);

		const [applications, users, admins, activeSessions, signIns24h, failedSignIns24h, daily, topApplications, recentEvents] =
			await Promise.all([
				services.clients.count(),
				services.users.countByRole("user"),
				services.users.countByRole("admin"),
				services.sessions.countActive(now),
				services.audit.countSignIns("success", dayAgo),
				services.audit.countSignIns("failure", dayAgo),
				services.audit.dailySignIns(activitySince),
				services.audit.topClients(new Date(now.getTime() - 30 * DAY_MS), 5),
				services.audit.recent(6),
			]);

		const activity = new Map<string, OverviewActivityDay>(days.map((date) => [date, { date, succeeded: 0, failed: 0 }]));
		for (const row of daily) {
			const entry = activity.get(row.day);
			if (entry) {
				entry[row.outcome === "success" ? "succeeded" : "failed"] += row.value;
			}
		}

		return {
			instanceName: settings.instanceName,
			generatedAt: now.toISOString(),
			stats: {
				applications,
				users,
				admins,
				activeSessions,
				signIns24h,
				failedSignIns24h,
			},
			activity: [...activity.values()],
			topApplications: topApplications.map((entry) => ({
				id: entry.id,
				name: entry.name,
				logoUrl: entry.id ? applicationLogoUrl(entry.id, entry.logoHash) : null,
				authorizations: entry.value,
			})),
			recentEvents,
		};
	});
}
