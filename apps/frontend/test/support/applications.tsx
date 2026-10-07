import type { ClientDto } from "@aegis/contracts";
import type { ReactNode } from "react";
import { expect } from "vitest";
import { page } from "vitest/browser";
import { ApplicationLayout } from "@/components/applications/application-layout";
import { HeaderBreadcrumbs } from "@/components/dashboard/breadcrumbs";
import { mockApi, type Route } from "./api";
import { client, me, NOW } from "./fixtures";
import { setLocation } from "./next/navigation";
import { renderUi } from "./render";

// Applications as the administration shows them, and the page that hosts the tabs of one.

export const WIKI = client();

export const SPA = client({
	id: "3220506287531888701",
	name: "Dashboard",
	type: "public",
	tokenEndpointAuthMethod: "none",
	redirectUris: ["https://dash.example.com/callback"],
	postLogoutRedirectUris: [],
	pkcePolicy: "required",
	accessPolicy: "assigned",
	assignedUserCount: 2,
	enabled: false,
	lastAuthorizedAt: NOW,
	activeSessionCount: 3,
	secretRotatedAt: null,
});

export const NATIVE = client({
	id: "3220506287531888702",
	name: "Mobile",
	type: "public",
	tokenEndpointAuthMethod: "none",
	redirectUris: ["com.example.app:/callback"],
});

/** Renders a tab of the application page `/applications/<id>/<tab>` with the header breadcrumbs above it. */
export async function renderApplication(tab: ReactNode, application: ClientDto, routes: Record<string, Route> = {}, path = "") {
	const server = mockApi({ [`GET /api/applications/${application.id}`]: { body: { client: application } }, ...routes });
	setLocation(`/applications/${application.id}${path}`);
	const screen = await renderUi(
		<>
			<HeaderBreadcrumbs />
			<ApplicationLayout>{tab}</ApplicationLayout>
		</>,
		{ me: me() },
	);
	await expect.element(page.getByRole("heading", { level: 1 })).toMatchTextContent(application.name);
	return { ...screen, server };
}
