import { AppWindow, LayoutDashboard, type LucideIcon, MonitorSmartphone, ScrollText, Settings, Users } from "lucide-react";

export type NavKey = "dashboard" | "applications" | "users" | "sessions" | "audit" | "settings";

export interface NavItem {
	href: string;
	key: NavKey;
	icon: LucideIcon;
	exact?: boolean;
}

export interface NavGroup {
	key: "main" | "manage" | "system";
	items: NavItem[];
}

/** Navigation of the administration UI. */
export const NAV_GROUPS: NavGroup[] = [
	{
		key: "main",
		items: [{ href: "/", key: "dashboard", icon: LayoutDashboard, exact: true }],
	},
	{
		key: "manage",
		items: [
			{ href: "/applications", key: "applications", icon: AppWindow },
			{ href: "/users", key: "users", icon: Users },
			{ href: "/sessions", key: "sessions", icon: MonitorSmartphone },
		],
	},
	{
		key: "system",
		items: [
			{ href: "/audit", key: "audit", icon: ScrollText },
			{ href: "/settings", key: "settings", icon: Settings },
		],
	},
];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
	return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function activeNavItem(pathname: string): NavItem | undefined {
	return NAV_GROUPS.flatMap((group) => group.items).find((item) => isNavItemActive(item, pathname));
}
