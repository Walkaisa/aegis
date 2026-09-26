"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * The side panel a table row opens, e.g. a session or an audit event. It keeps showing the last
 * item while it slides out, so the content does not vanish before the panel does.
 */
export function DetailSheet<T>({
	item,
	onClose,
	children,
}: {
	/** The item shown; `null` closes the panel. */
	item: T | null;
	onClose: () => void;
	children: (item: T) => ReactNode;
}) {
	const [shown, setShown] = useState(item);
	if (item !== null && item !== shown) {
		setShown(item);
	}

	return (
		<Sheet open={item !== null} onOpenChange={(open) => !open && onClose()}>
			<SheetContent showCloseButton={false} className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
				{shown === null ? null : children(shown)}
			</SheetContent>
		</Sheet>
	);
}

/** Icon, title and a line below it, with the close button in the corner. */
export function DetailSheetHeader({ icon, title, description }: { icon: ReactNode; title: ReactNode; description?: ReactNode }) {
	const t = useTranslations("common");

	return (
		<SheetHeader className="flex-row items-start gap-3 border-b p-5 pr-14">
			{icon}
			<div className="flex min-w-0 flex-col gap-1">
				<SheetTitle className="text-base leading-snug text-pretty">{title}</SheetTitle>
				{description ? (
					<SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">{description}</SheetDescription>
				) : null}
			</div>
			<SheetClose asChild>
				<Button variant="ghost" size="icon-sm" className="absolute top-4 right-4" aria-label={t("close")}>
					<X />
				</Button>
			</SheetClose>
		</SheetHeader>
	);
}

/** The icon of a panel header: a tinted square, as on the detail pages. */
export function DetailSheetIcon({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<span
			className={cn(
				"flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 ring-inset [&_svg]:size-4.5",
				className,
			)}
		>
			{children}
		</span>
	);
}

export function DetailSheetBody({ children }: { children: ReactNode }) {
	return <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">{children}</div>;
}

export function DetailSheetFooter({ children }: { children: ReactNode }) {
	return <SheetFooter className="border-t p-4">{children}</SheetFooter>;
}

/** A titled group of the panel. */
export function DetailSheetSection({ title, children }: { title: ReactNode; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-2">
			<h3 className="px-1 text-xs font-medium text-muted-foreground">{title}</h3>
			{children}
		</section>
	);
}

/** Label/value rows in a card, one fact per row. */
export function DetailSheetFacts({ children }: { children: ReactNode }) {
	return <dl className="divide-y rounded-xl border bg-card">{children}</dl>;
}

export function DetailSheetFact({ label, children }: { label: ReactNode; children: ReactNode }) {
	return (
		<div className="flex min-h-11 items-center justify-between gap-4 px-3 py-2.5 text-sm">
			<dt className="shrink-0 text-muted-foreground">{label}</dt>
			<dd className="flex min-w-0 items-center justify-end gap-1.5 text-right font-medium [overflow-wrap:anywhere] [&>svg]:shrink-0">
				{children}
			</dd>
		</div>
	);
}

/** Raw technical text below a group, e.g. the full User-Agent. */
export function DetailSheetRaw({ children }: { children: ReactNode }) {
	return <p className="px-1 font-mono text-[11px] leading-relaxed break-all text-muted-foreground">{children}</p>;
}
