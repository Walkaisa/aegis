"use client";

import { ChevronsUpDown, LogOut, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { BrandMark } from "@/components/brand";
import { useAccount } from "@/components/dashboard/account-context";
import { isNavItemActive, NAV_GROUPS } from "@/components/dashboard/navigation";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import { UserAvatar } from "@/components/users/account-badges";
import { api } from "@/lib/api";

export function AppSidebar() {
	const t = useTranslations("nav");
	const pathname = usePathname();
	const { me } = useAccount();
	const { isMobile, setOpenMobile } = useSidebar();

	const closeOnMobile = () => {
		if (isMobile) {
			setOpenMobile(false);
		}
	};

	return (
		<Sidebar collapsible="icon" variant="sidebar">
			<SidebarHeader className="gap-0 pb-0">
				{/* Brand, primary action and divider share one 12px rhythm down to the navigation. */}
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<Link href="/" onClick={closeOnMobile}>
								<BrandMark />
								<div className="grid min-w-0 flex-1 text-left leading-tight">
									<span className="truncate font-semibold">{me.instanceName}</span>
									<span className="truncate text-xs text-muted-foreground">{t("tagline")}</span>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
					{/* The primary action belongs to the header block; the divider below keeps it apart from the navigation. */}
					<SidebarMenuItem className="mt-3">
						<SidebarMenuButton
							asChild
							tooltip={t("newApplication")}
							className="h-9 justify-start gap-2.5 border border-dashed border-primary/40 bg-primary/8 font-medium text-primary transition-all hover:border-solid hover:border-primary/60 hover:bg-primary/14 hover:text-primary active:bg-primary/20 active:text-primary group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:border-solid group-data-[collapsible=icon]:p-0!"
						>
							<Link href="/applications/new" aria-label={t("newApplication")} onClick={closeOnMobile}>
								<Plus className="rounded-[5px] bg-primary p-0.5 text-primary-foreground" strokeWidth={3} />
								<span className="group-data-[collapsible=icon]:hidden">{t("newApplication")}</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				<div aria-hidden="true" className="-mx-2 mt-3 h-px bg-sidebar-border" />
			</SidebarHeader>

			<SidebarContent>
				{NAV_GROUPS.map((group) => (
					<SidebarGroup key={group.key} className={group.key === "main" ? "pt-3" : undefined}>
						{group.key === "main" ? null : <SidebarGroupLabel>{t(`groups.${group.key}`)}</SidebarGroupLabel>}
						<SidebarGroupContent>
							<SidebarMenu>
								{group.items.map((item) => {
									const label = t(item.key);
									return (
										<SidebarMenuItem key={item.href}>
											<SidebarMenuButton
												asChild
												isActive={isNavItemActive(item, pathname)}
												tooltip={label}
												className="data-[active=true]:[&>svg]:text-primary"
											>
												<Link href={item.href} onClick={closeOnMobile}>
													<item.icon />
													<span>{label}</span>
												</Link>
											</SidebarMenuButton>
										</SidebarMenuItem>
									);
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>

			<SidebarFooter>
				<AccountMenu onNavigate={closeOnMobile} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}

function AccountMenu({ onNavigate }: { onNavigate: () => void }) {
	const t = useTranslations("nav");
	const { me } = useAccount();
	const { isMobile } = useSidebar();
	const [signingOut, setSigningOut] = useState(false);

	async function signOut() {
		setSigningOut(true);
		try {
			await api.delete("/auth/session");
		} finally {
			window.location.assign("/sign-in");
		}
	}

	const accountSummary = (
		<>
			<UserAvatar name={me.account.displayName} src={me.account.avatarUrl} size="sm-round" />
			<div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
				<span className="truncate font-medium">{me.account.displayName}</span>
				<span className="truncate text-xs text-muted-foreground">{me.account.email}</span>
			</div>
		</>
	);

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							{accountSummary}
							<ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="min-w-60" side={isMobile ? "bottom" : "right"} align="end" sideOffset={8}>
						<DropdownMenuLabel className="flex items-center gap-2 font-normal">{accountSummary}</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild>
							<Link href="/settings/account" onClick={onNavigate}>
								<UserRound />
								{t("account")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							variant="destructive"
							disabled={signingOut}
							onSelect={(event) => {
								event.preventDefault();
								void signOut();
							}}
						>
							<LogOut />
							{t("signOut")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
