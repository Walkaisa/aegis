import { CircleAlert, CircleCheck, Info, type LucideIcon, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const STATUS_TONES = ["success", "warning", "error", "info"] as const;

export type StatusTone = (typeof STATUS_TONES)[number];

interface ToneStyle {
	icon: LucideIcon;
	/** Border, background and icon colour of the message. */
	surface: string;
	media: string;
}

const TONE_STYLES: Record<StatusTone, ToneStyle> = {
	success: {
		icon: CircleCheck,
		surface: "border-success/30 bg-success/8 text-foreground dark:bg-success/12",
		media: "bg-success/15 text-success",
	},
	warning: {
		icon: TriangleAlert,
		surface: "border-warning/35 bg-warning/10 text-foreground dark:bg-warning/12",
		media: "bg-warning/18 text-warning",
	},
	error: {
		icon: CircleAlert,
		surface: "border-destructive/30 bg-destructive/8 text-foreground dark:bg-destructive/12",
		media: "bg-destructive/15 text-destructive",
	},
	info: {
		icon: Info,
		surface: "border-info/30 bg-info/8 text-foreground dark:bg-info/12",
		media: "bg-info/15 text-info",
	},
};

/**
 * A coloured, self-explanatory status banner: green for success, amber for a warning, red for an
 * error and blue for information. Used wherever a message must not be overlooked — after creating
 * an application or an account, or next to a value that is shown exactly once.
 */
export function StatusMessage({
	tone = "info",
	title,
	children,
	action,
	icon,
	className,
}: {
	tone?: StatusTone;
	title?: ReactNode;
	children?: ReactNode;
	/** Buttons or links placed at the end of the message. */
	action?: ReactNode;
	/** Replaces the icon implied by the tone. */
	icon?: ReactNode;
	className?: string;
}) {
	const style = TONE_STYLES[tone];
	const Icon = style.icon;

	return (
		<div
			role={tone === "error" ? "alert" : "status"}
			data-tone={tone}
			className={cn("flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm", style.surface, className)}
		>
			<span
				aria-hidden="true"
				className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4", style.media)}
			>
				{icon ?? <Icon />}
			</span>
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				{title ? <p className="font-medium text-balance">{title}</p> : null}
				{children ? <div className="text-sm text-pretty text-muted-foreground">{children}</div> : null}
				{action ? <div className="mt-1 flex flex-wrap items-center gap-2">{action}</div> : null}
			</div>
		</div>
	);
}
