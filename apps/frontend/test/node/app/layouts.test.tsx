import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import ApplicationLayoutRoute, {
	dynamicParams as applicationDynamicParams,
	generateStaticParams as applicationStaticParams,
} from "@/app/[locale]/(admin)/applications/[id]/layout";
import AdminLayout from "@/app/[locale]/(admin)/layout";
import SettingsLayoutRoute from "@/app/[locale]/(admin)/settings/layout";
import UserLayoutRoute, {
	dynamicParams as userDynamicParams,
	generateStaticParams as userStaticParams,
} from "@/app/[locale]/(admin)/users/[id]/layout";
import AuthLayout from "@/app/[locale]/(auth)/layout";
import { ApplicationLayout } from "@/components/applications/application-layout";
import { AppShell } from "@/components/dashboard/app-shell";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { UserLayout } from "@/components/users/user-layout";
import { localeProps, renderExport } from "../../support/export";
import { MESSAGES } from "../../support/messages";

const content = <p>content</p>;

describe("administration layouts", () => {
	it("wrap the pages in the shell, the settings tabs and the detail pages", () => {
		expect((AdminLayout({ children: content }) as ReactElement).type).toBe(AppShell);
		expect((SettingsLayoutRoute({ children: content }) as ReactElement).type).toBe(SettingsLayout);
		expect((ApplicationLayoutRoute({ children: content }) as ReactElement).type).toBe(ApplicationLayout);
		expect((UserLayoutRoute({ children: content }) as ReactElement).type).toBe(UserLayout);
	});

	it("export each detail page once, for the backend to serve under every id", () => {
		expect(applicationStaticParams()).toEqual([{ id: "[id]" }]);
		expect(userStaticParams()).toEqual([{ id: "[id]" }]);
		expect(applicationDynamicParams).toBe(false);
		expect(userDynamicParams).toBe(false);
	});
});

describe("sign-in layout", () => {
	it("frames the page with the preferences and the Aegis footer in its language", async () => {
		const html = renderExport(await AuthLayout({ children: content, ...localeProps("de") }), "de");

		expect(html).toContain("<p>content</p>");
		expect(html).toContain(MESSAGES.de.common.securedBy);
		expect(html).toContain(`aria-label="${MESSAGES.de.preferences.language}"`);
	});
});
