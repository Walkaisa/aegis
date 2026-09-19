"use client";

import { useFormatter } from "next-intl";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * A key figure. The label and a small icon share the top row, the value sits below on a fixed
 * baseline, so figures line up across a row of cards regardless of label length.
 */
export function StatCard({
	label,
	value,
	icon,
	tone = "default",
}: {
	label: ReactNode;
	value: number | null;
	icon: ReactNode;
	/** `danger` highlights non-zero values, e.g. failed sign-ins. */
	tone?: "default" | "danger";
}) {
	const format = useFormatter();
	const alert = tone === "danger" && Boolean(value);

	return (
		<div className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
			<div className="flex items-center justify-between gap-3">
				<span className="truncate text-sm font-medium text-muted-foreground">{label}</span>
				<span
					className={cn(
						"flex size-9 shrink-0 items-center justify-center rounded-lg border [&_svg]:size-4",
						alert ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-primary/25 bg-primary/10 text-primary",
					)}
				>
					{icon}
				</span>
			</div>
			<div className="flex h-9 items-end">
				{value === null ? (
					<Skeleton className="h-8 w-16" />
				) : (
					<span className={cn("text-3xl leading-none font-semibold tracking-tight tabular-nums", alert && "text-destructive")}>
						{format.number(value)}
					</span>
				)}
			</div>
		</div>
	);
}
