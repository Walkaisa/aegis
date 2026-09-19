import { type AuditPageResponse, type AuditSummaryResponse, auditQuerySchema } from "@aegis/contracts";
import type { FastifyInstance } from "fastify";
import { parseInput } from "../../lib/validation.js";
import { access } from "../access.js";
import { requireSettings } from "../request-context.js";

/** `/api/audit`: the audit log. Both routes take the same filters as query parameters. */
export async function auditRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;

	/** One page of events. */
	app.get("/events", access("audit:read"), async (request): Promise<AuditPageResponse> => {
		return services.audit.list(parseInput(auditQuerySchema, request.query));
	});

	/** Totals per severity and the covered time span. */
	app.get("/summary", access("audit:read"), async (request): Promise<AuditSummaryResponse> => {
		const query = parseInput(auditQuerySchema, request.query);
		return services.audit.summary(query, requireSettings(services).auditRetentionDays);
	});
}
