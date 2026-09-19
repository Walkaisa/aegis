"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, Fragment, type ReactNode, useCallback, useContext, useEffect, useId, useMemo, useState } from "react";
import { useAccount } from "@/components/dashboard/account-context";
import { activeNavItem } from "@/components/dashboard/navigation";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/** One step of the trail. Without `href` the step is not navigable. */
export interface Crumb {
	label: string;
	href?: string;
}

interface Published {
	key: string;
	trail: Crumb[];
}

interface BreadcrumbsContextValue {
	published: Published | null;
	/** Registers the steps below the section; `null` clears them again. */
	publish: (key: string, trail: Crumb[] | null) => void;
}

const BreadcrumbsContext = createContext<BreadcrumbsContextValue | null>(null);

export function BreadcrumbsProvider({ children }: { children: ReactNode }) {
	const [published, setPublished] = useState<Published | null>(null);

	// Stable, so the registering effect below does not re-run on every trail change.
	const publish = useCallback((key: string, trail: Crumb[] | null) => {
		setPublished((current) => {
			if (trail === null) {
				// Only the owner may clear it; during a route change the next page registers first.
				return current?.key === key ? null : current;
			}
			return { key, trail };
		});
	}, []);

	const value = useMemo<BreadcrumbsContextValue>(() => ({ published, publish }), [published, publish]);

	return <BreadcrumbsContext.Provider value={value}>{children}</BreadcrumbsContext.Provider>;
}

/**
 * Names the page in the header breadcrumb, e.g. with the name of the application being viewed.
 * Pass `null` while the data is still loading; the trail then ends at the section.
 */
export function useBreadcrumbs(trail: Crumb[] | null): void {
	const context = useContext(BreadcrumbsContext);
	const publish = context?.publish;
	const key = useId();
	// The array is rebuilt on every render, so depend on its content instead of its identity.
	const serialized = trail === null ? null : JSON.stringify(trail);

	useEffect(() => {
		if (!publish) {
			return;
		}
		publish(key, serialized === null ? null : (JSON.parse(serialized) as Crumb[]));
		return () => publish(key, null);
	}, [key, serialized, publish]);
}

/** Steps for pages that have no data of their own to name them. */
const STATIC_TRAILS: Record<string, string> = {
	"/applications/new": "newApplication",
	"/users/new": "newUser",
	"/settings/account": "account",
	"/settings/security": "security",
};

/** `Aegis › Applications › New application` – the trail of the page currently open. */
export function HeaderBreadcrumbs() {
	const t = useTranslations("nav");
	const tCrumbs = useTranslations("breadcrumbs");
	const pathname = usePathname();
	const { me } = useAccount();
	const context = useContext(BreadcrumbsContext);

	const section = activeNavItem(pathname);
	const staticKey = STATIC_TRAILS[pathname];
	const rest = context?.published?.trail ?? (staticKey ? [{ label: tCrumbs(staticKey) }] : []);

	const crumbs: Crumb[] = [
		{ label: me.instanceName, href: "/" },
		// The section links to its own page, unless that page is the one we are on.
		...(section && section.href !== "/" ? [{ label: t(section.key), href: section.href }] : []),
		...rest,
	];

	return (
		<Breadcrumb className="min-w-0">
			<BreadcrumbList className="flex-nowrap">
				{crumbs.map((crumb, index) => {
					const last = index === crumbs.length - 1;
					return (
						<Fragment key={`${crumb.href ?? "current"}-${crumb.label}`}>
							{index > 0 ? <BreadcrumbSeparator className="shrink-0" /> : null}
							<BreadcrumbItem className="min-w-0">
								{last || !crumb.href ? (
									<BreadcrumbPage className="truncate font-medium">{crumb.label}</BreadcrumbPage>
								) : (
									<BreadcrumbLink asChild className="truncate">
										<Link href={crumb.href}>{crumb.label}</Link>
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
						</Fragment>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
