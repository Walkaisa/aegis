import type { Metadata } from "next";
import { type ComponentType, Fragment, isValidElement, type ReactElement, type ReactNode, Suspense } from "react";
import { describe, expect, it } from "vitest";
import { ApplicationAccess } from "@/components/applications/application-access";
import { ApplicationQuickstart } from "@/components/applications/application-quickstart";
import { ApplicationSettings } from "@/components/applications/application-settings";
import { ApplicationsPage } from "@/components/applications/applications-page";
import { ApplicationSessions } from "@/components/applications/client-sessions";
import { NewApplicationPage } from "@/components/applications/new-application-page";
import { AuditPage } from "@/components/audit/audit-page";
import { AuthPending } from "@/components/auth/auth-card";
import { AuthRequestFlow, AuthRequestLoading } from "@/components/auth/auth-request-flow";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { OidcError } from "@/components/auth/oidc-error";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { SetupForm } from "@/components/auth/setup-form";
import { SignInForm } from "@/components/auth/sign-in-form";
import { VerifyEmailCard } from "@/components/auth/verify-email-card";
import { OverviewPage } from "@/components/overview/overview-page";
import { SessionsPage } from "@/components/sessions/sessions-page";
import { AccountSettings } from "@/components/settings/account-settings";
import { EmailSettings } from "@/components/settings/email-settings";
import { GeneralSettings } from "@/components/settings/general-settings";
import { SecuritySettings } from "@/components/settings/security-settings";
import { VersionSettings } from "@/components/settings/version-settings";
import { NewUserPage } from "@/components/users/new-user-page";
import { UserApplications } from "@/components/users/user-applications";
import { UserOverview } from "@/components/users/user-overview";
import { UserSessions } from "@/components/users/user-sessions";
import { UserSettings } from "@/components/users/user-settings";
import { UsersPage } from "@/components/users/users-page";
import { localeProps, renderExport } from "../../support/export";
import { MESSAGES } from "../../support/messages";

interface PageModule {
	default: (props: ReturnType<typeof localeProps>) => ReactNode | Promise<ReactNode>;
	generateMetadata?: (props: ReturnType<typeof localeProps>) => Promise<Metadata>;
}

/** Every page of the export, keyed by its path below `app/[locale]`. Next.js types the modules as `unknown`. */
const modules = import.meta.glob("@/app/**/page.tsx", { eager: true }) as Record<string, PageModule>;
const pages = new Map(
	Object.entries(modules).map(([file, module]) => [file.replace(/^.*\/app\/\[locale\]\/(.*)page\.tsx$/, "$1"), module]),
);

type Messages = typeof MESSAGES.en;

/**
 * What each page renders and the message that titles it. Client pages hand over to their component
 * (and a Suspense fallback while the URL is read); the server-rendered ones are checked below.
 */
const ROUTES: Record<string, { renders: ComponentType[]; title: (messages: Messages) => string }> = {
	"(admin)/": { renders: [OverviewPage], title: (m) => m.overview.title },
	"(admin)/applications/": { renders: [ApplicationsPage], title: (m) => m.applications.title },
	"(admin)/applications/new/": { renders: [NewApplicationPage], title: (m) => m.newApplication.title },
	"(admin)/applications/[id]/": { renders: [ApplicationQuickstart], title: (m) => m.applicationDetail.tabs.quickstart },
	"(admin)/applications/[id]/access/": { renders: [ApplicationAccess], title: (m) => m.applicationDetail.tabs.access },
	"(admin)/applications/[id]/sessions/": { renders: [ApplicationSessions], title: (m) => m.applicationDetail.tabs.sessions },
	"(admin)/applications/[id]/settings/": { renders: [ApplicationSettings], title: (m) => m.applicationDetail.tabs.settings },
	"(admin)/audit/": { renders: [AuditPage], title: (m) => m.audit.title },
	"(admin)/sessions/": { renders: [SessionsPage], title: (m) => m.sessions.title },
	"(admin)/settings/": { renders: [GeneralSettings, VersionSettings], title: (m) => m.settings.title },
	"(admin)/settings/account/": { renders: [AccountSettings], title: (m) => m.settings.tabs.account },
	"(admin)/settings/email/": { renders: [EmailSettings], title: (m) => m.emailSettings.title },
	"(admin)/settings/security/": { renders: [SecuritySettings], title: (m) => m.settings.tabs.security },
	"(admin)/users/": { renders: [UsersPage], title: (m) => m.users.title },
	"(admin)/users/new/": { renders: [NewUserPage], title: (m) => m.newUser.title },
	"(admin)/users/[id]/": { renders: [UserOverview], title: (m) => m.userDetail.tabs.overview },
	"(admin)/users/[id]/applications/": { renders: [UserApplications], title: (m) => m.userDetail.tabs.applications },
	"(admin)/users/[id]/sessions/": { renders: [UserSessions], title: (m) => m.userDetail.tabs.sessions },
	"(admin)/users/[id]/settings/": { renders: [UserSettings], title: (m) => m.userDetail.tabs.settings },
	"(auth)/consent/": { renders: [AuthRequestFlow, AuthRequestLoading], title: (m) => m.authRequest.consentPageTitle },
	"(auth)/error/": { renders: [OidcError, AuthPending], title: (m) => m.oidcError.pageTitle },
	"(auth)/forgot-password/": { renders: [ForgotPasswordForm], title: (m) => m.forgotPassword.pageTitle },
	"(auth)/reset-password/": { renders: [ResetPasswordForm], title: (m) => m.resetPassword.pageTitle },
	"(auth)/setup/": { renders: [SetupForm], title: (m) => m.setup.title },
	"(auth)/sign-in/": { renders: [SignInForm], title: (m) => m.signIn.pageTitle },
	"(auth)/sign-in/application/": { renders: [AuthRequestFlow, AuthRequestLoading], title: (m) => m.signIn.pageTitle },
	"(auth)/verify-email/": { renders: [VerifyEmailCard], title: (m) => m.verifyEmail.pageTitle },
};
const SERVER_RENDERED = ["(auth)/signed-out/", "404/"];

/** The components an element hands over to: itself, or the children and fallback of a wrapper. */
function componentsOf(node: ReactNode): unknown[] {
	if (!isValidElement(node)) {
		return [];
	}
	const element = node as ReactElement<{ children?: ReactNode; fallback?: ReactNode }>;
	if (element.type === Fragment || element.type === Suspense) {
		return [element.props.children, element.props.fallback].flatMap((child) => [child].flat().flatMap(componentsOf));
	}
	return [element.type];
}

function pageAt(route: string): PageModule {
	const module = pages.get(route);
	if (!module) {
		throw new Error(`No page at ${route}`);
	}
	return module;
}

describe("pages", () => {
	it("are all accounted for", () => {
		expect([...pages.keys()].sort()).toEqual([...Object.keys(ROUTES), ...SERVER_RENDERED].sort());
	});

	it.each(Object.entries(ROUTES))("%s renders its component, titled in every language", async (route, { renders, title }) => {
		const page = pageAt(route);

		expect(componentsOf(await page.default(localeProps("en")))).toEqual(renders);
		expect(await page.generateMetadata?.(localeProps("en"))).toEqual({ title: title(MESSAGES.en) });
		expect(await page.generateMetadata?.(localeProps("de"))).toEqual({ title: title(MESSAGES.de) });
	});

	it("tells an application's user they are signed out", async () => {
		const page = pageAt("(auth)/signed-out/");

		expect(renderExport(await page.default(localeProps("de")), "de")).toContain(MESSAGES.de.signedOut.description);
		expect(await page.generateMetadata?.(localeProps("en"))).toEqual({ title: MESSAGES.en.signedOut.title });
	});

	it("answers unknown addresses with a page that leads home", async () => {
		const html = renderExport(await pageAt("404/").default(localeProps("en")));

		expect(html).toContain(MESSAGES.en.notFound.title);
		expect(html).toContain('href="/"');
	});
});
