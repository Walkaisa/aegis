import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Vertical rhythm shared by every dashboard page. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
	return <div className={cn("flex flex-col gap-8", className)}>{children}</div>;
}

export function PageHeader({
	title,
	description,
	actions,
	back,
	media,
}: {
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	back?: ReactNode;
	media?: ReactNode;
}) {
	return (
		<header className="flex flex-col gap-4">
			{back}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex min-w-0 items-center gap-4">
					{media}
					{/* Next to a picture, title and description sit closer together so they read as one block. */}
					<div className={cn("flex min-w-0 flex-col", media ? "gap-0.5" : "gap-1")}>
						<h1 className={cn("text-2xl font-semibold tracking-tight text-balance", media && "leading-7")}>{title}</h1>
						{description ? <div className="text-sm text-pretty text-muted-foreground">{description}</div> : null}
					</div>
				</div>
				{actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
			</div>
		</header>
	);
}

/**
 * Title, description and actions of a tab whose content brings its own frame, like a data table; the
 * counterpart of `PageHeader` one level down.
 */
export function SectionHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex min-w-0 flex-col gap-1">
				<h2 className="text-lg font-semibold tracking-tight text-balance">{title}</h2>
				{description ? <p className="text-sm text-pretty text-muted-foreground">{description}</p> : null}
			</div>
			{actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
		</div>
	);
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
	return (
		<Link
			href={href}
			className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
		>
			<ArrowLeft className="size-4" />
			{children}
		</Link>
	);
}

/** A titled card section; the building block of settings-style pages. */
export function Section({
	title,
	description,
	action,
	footer,
	children,
	className,
	contentClassName,
}: {
	title?: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	footer?: ReactNode;
	children: ReactNode;
	className?: string;
	contentClassName?: string;
}) {
	return (
		<Card className={cn("gap-0 py-0", className)}>
			{title || action ? (
				<CardHeader className="border-b pt-4">
					{title ? <CardTitle className="font-semibold">{title}</CardTitle> : null}
					{description ? <CardDescription>{description}</CardDescription> : null}
					{action ? <CardAction>{action}</CardAction> : null}
				</CardHeader>
			) : null}
			<CardContent className={cn("py-5", contentClassName)}>{children}</CardContent>
			{footer ? <CardFooter className="justify-end gap-2 py-3">{footer}</CardFooter> : null}
		</Card>
	);
}

/**
 * Explanation on the left, action on the right. The row wraps instead of squeezing the text,
 * because these sections also live in the narrow column of a two-column page.
 */
export function ActionRow({ children, action }: { children: ReactNode; action: ReactNode }) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-4">
			<div className="min-w-56 flex-1 text-sm text-muted-foreground">{children}</div>
			<div className="shrink-0">{action}</div>
		</div>
	);
}

/** Label/value pairs for read-only details. */
export function DetailList({ children }: { children: ReactNode }) {
	return <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>;
}

export function Detail({ label, children }: { label: ReactNode; children: ReactNode }) {
	return (
		<div className="flex min-w-0 flex-col gap-1">
			<dt className="text-xs font-medium text-muted-foreground">{label}</dt>
			<dd className="min-w-0 text-sm break-words">{children}</dd>
		</div>
	);
}

/** Read-only facts of an entity in the side column of a detail page. */
export function DetailsCard({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) {
	return (
		<Section title={title} action={action}>
			<dl className="flex flex-col divide-y text-sm [&>div]:py-2.5 [&>div:first-child]:pt-0 [&>div:last-child]:pb-0">{children}</dl>
		</Section>
	);
}

export function DetailRow({ label, children }: { label: ReactNode; children: ReactNode }) {
	return (
		<div className="flex items-start justify-between gap-4">
			<dt className="shrink-0 text-muted-foreground">{label}</dt>
			<dd className="min-w-0 text-right font-medium break-words">{children}</dd>
		</div>
	);
}

export interface Fact {
	icon: ReactNode;
	label: ReactNode;
	value: ReactNode;
	/** Secondary line below the value. */
	hint?: ReactNode;
}

/** A row of key facts at the top of a detail page. */
export function FactGrid({ facts, className }: { facts: Fact[]; className?: string }) {
	return (
		<dl className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
			{facts.map((fact, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: the facts are a fixed list per page
				<div key={index} className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
					<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 ring-inset [&_svg]:size-4.5">
						{fact.icon}
					</span>
					<div className="flex min-w-0 flex-col">
						<dt className="truncate text-xs text-muted-foreground">{fact.label}</dt>
						<dd className="truncate text-sm font-semibold">{fact.value}</dd>
						{fact.hint ? <dd className="truncate text-xs text-muted-foreground">{fact.hint}</dd> : null}
					</div>
				</div>
			))}
		</dl>
	);
}

/** The destructive section at the end of a settings tab. */
export function DangerZone({
	title,
	description,
	children,
	action,
}: {
	title: ReactNode;
	description: ReactNode;
	children: ReactNode;
	action: ReactNode;
}) {
	return (
		<Section title={<span className="text-destructive">{title}</span>} description={description} className="ring-destructive/30">
			<ActionRow action={action}>{children}</ActionRow>
		</Section>
	);
}
