"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TabNavItem {
	href: string;
	label: string;
	count?: number | null;
}

/** Underlined tab navigation between sub-pages, e.g. of an application or the settings. */
export function TabNav({ items, label }: { items: TabNavItem[]; label: string }) {
	const pathname = usePathname();

	return (
		<nav className="no-scrollbar flex gap-6 overflow-x-auto overflow-y-hidden border-b" aria-label={label}>
			{items.map((item) => {
				const active = pathname === item.href;
				return (
					<Link
						key={item.href}
						href={item.href}
						aria-current={active ? "page" : undefined}
						className={cn(
							"relative -mb-px inline-flex items-center gap-2 border-b-2 border-transparent pb-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
							active && "border-primary text-foreground",
						)}
					>
						{item.label}
						{item.count ? (
							<Badge variant="secondary" className="h-5 min-w-5 px-1.5 tabular-nums">
								{item.count}
							</Badge>
						) : null}
					</Link>
				);
			})}
		</nav>
	);
}
