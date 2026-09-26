"use client";

import type { AuthSessionResponse } from "@aegis/contracts";
import { type ReactNode, useMemo } from "react";
import { AccountProvider } from "@/components/dashboard/account-context";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { BreadcrumbsProvider, HeaderBreadcrumbs } from "@/components/dashboard/breadcrumbs";
import { ErrorState } from "@/components/dashboard/states";
import { PreferencesMenu } from "@/components/preferences-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useApiQuery } from "@/hooks/use-api-query";

/** Frame of the administration UI; only rendered for a signed-in admin. */
export function AppShell({ defaultOpen, children }: { defaultOpen: boolean; children: ReactNode }) {
	const { data, error, reload, setData } = useApiQuery<AuthSessionResponse>("/auth/session");

	const account = useMemo(() => (data ? { me: data, reload, update: setData } : null), [data, reload, setData]);

	if (!account) {
		return (
			<div className="flex min-h-svh items-center justify-center p-6">
				{error && error.code !== "unauthorized" ? (
					<div className="w-full max-w-md">
						<ErrorState error={error} onRetry={() => void reload()} />
					</div>
				) : (
					<Spinner className="size-6 text-muted-foreground" />
				)}
			</div>
		);
	}

	return (
		<AccountProvider value={account}>
			<BreadcrumbsProvider>
				<SidebarProvider defaultOpen={defaultOpen}>
					<AppSidebar />
					<SidebarInset className="min-w-0">
						<header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur md:rounded-t-xl md:px-6">
							<div className="flex min-w-0 flex-1 items-center gap-2">
								<SidebarTrigger className="-ml-2.5" />
								<Separator orientation="vertical" className="mr-2 h-4 mt-1.5 self-center" />
								<HeaderBreadcrumbs />
							</div>
							<PreferencesMenu />
						</header>
						<main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-10">
							<div className="mx-auto w-full max-w-6xl">{children}</div>
						</main>
					</SidebarInset>
				</SidebarProvider>
			</BreadcrumbsProvider>
		</AccountProvider>
	);
}
