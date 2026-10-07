import { type AuditEventDto, type AuditEventType, auditQuerySchema } from "@aegis/contracts";
import { vi } from "vitest";
import type { TestAegis } from "./aegis.js";

/** The recorded audit events of one type, newest first. */
export async function auditEvents(aegis: TestAegis, type: AuditEventType): Promise<AuditEventDto[]> {
	const page = await aegis.services.audit.list(auditQuerySchema.parse({ perPage: 200 }));
	return page.events.filter((event) => event.type === type);
}

/** Waits for an event that is recorded in the background, e.g. after an OpenID Connect request. */
export async function awaitAuditEvent(aegis: TestAegis, type: AuditEventType): Promise<AuditEventDto> {
	const [event] = await awaitAuditEvents(aegis, type, 1);
	if (!event) {
		throw new Error(`No ${type} event`);
	}
	return event;
}

/**
 * Waits until `count` events of one type are recorded in the background. They are recorded in
 * whatever order their requests finish being processed, not necessarily in the order of the requests.
 */
export async function awaitAuditEvents(aegis: TestAegis, type: AuditEventType, count: number): Promise<AuditEventDto[]> {
	return vi.waitFor(
		async () => {
			const events = await auditEvents(aegis, type);
			if (events.length < count) {
				throw new Error(`${events.length} of ${count} ${type} events yet`);
			}
			return events;
		},
		{ timeout: 5_000, interval: 25 },
	);
}
