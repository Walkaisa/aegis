import type { UserDto } from "@aegis/contracts";
import type { ReactNode } from "react";
import { expect } from "vitest";
import { page } from "vitest/browser";
import { HeaderBreadcrumbs } from "@/components/dashboard/breadcrumbs";
import { UserLayout } from "@/components/users/user-layout";
import { mockApi, type Route } from "./api";
import { me, user } from "./fixtures";
import { setLocation } from "./next/navigation";
import { renderUi } from "./render";

// Accounts as the administration shows them, and the page that hosts the tabs of one.

export const GRACE = user({
	id: "3220506287531888650",
	displayName: "Grace Hopper",
	email: "grace@example.com",
	role: "user",
	lastSignInAt: null,
});

/** Renders a tab of the account page `/users/<id>/<tab>` with the header breadcrumbs above it. */
export async function renderAccount(tab: ReactNode, account: UserDto, routes: Record<string, Route> = {}, path = "") {
	const server = mockApi({ [`GET /api/users/${account.id}`]: { body: { user: account } }, ...routes });
	setLocation(`/users/${account.id}${path}`);
	const screen = await renderUi(
		<>
			<HeaderBreadcrumbs />
			<UserLayout>{tab}</UserLayout>
		</>,
		{ me: me() },
	);
	await expect.element(page.getByRole("heading", { level: 1 })).toMatchTextContent(account.displayName);
	return { ...screen, server };
}
