import type { AuditCategory, AuditOutcome, AuditSeverity, AuditSource, AuditTargetType } from "@aegis/contracts";
import {
	AppWindow,
	CircleCheck,
	CircleX,
	Info,
	KeyRound,
	type LucideIcon,
	Mail,
	MonitorSmartphone,
	OctagonAlert,
	Send,
	Server,
	Settings2,
	ShieldCheck,
	TriangleAlert,
	UserRound,
} from "lucide-react";

export const OUTCOME_STYLES = {
	success: { icon: CircleCheck, text: "text-success" },
	failure: { icon: CircleX, text: "text-destructive" },
} as const satisfies Record<AuditOutcome, { icon: LucideIcon; text: string }>;

export interface SeverityStyle {
	icon: LucideIcon;
	/** Colour of the label and the icon on its own. */
	text: string;
	/** Tinted square behind the icon. */
	surface: string;
	/** Coloured rail on the left edge of a row. */
	rail: string;
	/** Solid colour for dots and bar segments. */
	fill: string;
}

export const SEVERITY_STYLES: Record<AuditSeverity, SeverityStyle> = {
	info: {
		icon: Info,
		text: "text-severity-info",
		surface: "bg-severity-info/10 text-severity-info ring-severity-info/25",
		rail: "bg-severity-info/40",
		fill: "bg-severity-info",
	},
	notice: {
		icon: CircleCheck,
		text: "text-severity-notice",
		surface: "bg-severity-notice/10 text-severity-notice ring-severity-notice/25",
		rail: "bg-severity-notice/60",
		fill: "bg-severity-notice",
	},
	warning: {
		icon: TriangleAlert,
		text: "text-severity-warning",
		surface: "bg-severity-warning/10 text-severity-warning ring-severity-warning/30",
		rail: "bg-severity-warning/70",
		fill: "bg-severity-warning",
	},
	error: {
		icon: CircleX,
		text: "text-severity-error",
		surface: "bg-severity-error/10 text-severity-error ring-severity-error/30",
		rail: "bg-severity-error/80",
		fill: "bg-severity-error",
	},
	critical: {
		icon: OctagonAlert,
		text: "text-severity-critical",
		surface: "bg-severity-critical/15 text-severity-critical ring-severity-critical/40",
		rail: "bg-severity-critical",
		fill: "bg-severity-critical",
	},
};

export const CATEGORY_ICONS: Record<AuditCategory, LucideIcon> = {
	authentication: KeyRound,
	users: UserRound,
	applications: AppWindow,
	email: Mail,
	system: Settings2,
};

/** Soft tint per category, so a feed of events can be told apart at a glance. */
export const CATEGORY_SURFACES: Record<AuditCategory, string> = {
	authentication: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-300",
	users: "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-300",
	applications: "bg-teal-500/10 text-teal-600 ring-teal-500/20 dark:text-teal-300",
	email: "bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-300",
	system: "bg-zinc-500/10 text-zinc-600 ring-zinc-500/20 dark:text-zinc-300",
};

export const SOURCE_ICONS: Record<AuditSource, LucideIcon> = {
	admin: ShieldCheck,
	user: UserRound,
	application: AppWindow,
	system: Server,
};

export const TARGET_ICONS: Record<AuditTargetType, LucideIcon> = {
	account: UserRound,
	session: MonitorSmartphone,
	application: AppWindow,
	instance: Server,
	signing_key: KeyRound,
	message: Send,
};
