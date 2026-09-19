import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { cn } from "@/lib/utils";

/**
 * The card used by every sign-in page: brand above, an optional visual (application logo,
 * icon), title and description, the form, and a muted footer for secondary information.
 */
export function AuthCard({
	title,
	description,
	icon,
	media,
	brandName,
	children,
	footer,
	className,
}: {
	title: ReactNode;
	description?: ReactNode;
	icon?: ReactNode;
	media?: ReactNode;
	brandName?: string;
	children?: ReactNode;
	footer?: ReactNode;
	className?: string;
}) {
	const visual =
		media ??
		(icon ? (
			<div className="flex size-11 items-center justify-center rounded-xl border bg-muted/60 text-muted-foreground [&_svg]:size-5">
				{icon}
			</div>
		) : null);

	return (
		<div className={cn("mx-auto flex w-full max-w-[420px] flex-col gap-6", className)}>
			<div className="flex justify-center">
				<Brand name={brandName ?? "Aegis"} />
			</div>
			<div className="overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_48px_-16px_rgb(0_0_0/0.18)] dark:shadow-[0_16px_48px_-16px_rgb(0_0_0/0.7)]">
				<div className="flex flex-col items-center gap-5 px-6 pt-8 pb-6 text-center sm:px-10">
					{visual}
					<div className="flex flex-col gap-1.5">
						<h1 className="text-xl font-semibold tracking-tight text-balance">{title}</h1>
						{description ? <p className="text-sm text-balance text-muted-foreground">{description}</p> : null}
					</div>
				</div>
				{children ? <div className="px-6 pb-8 sm:px-10">{children}</div> : null}
				{footer ? (
					<div className="border-t bg-muted/40 px-6 py-4 text-center text-xs text-balance text-muted-foreground sm:px-10">
						{footer}
					</div>
				) : null}
			</div>
		</div>
	);
}

export function AuthStatus({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground" aria-live="polite">
			{children}
		</div>
	);
}
