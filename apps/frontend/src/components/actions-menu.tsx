"use client";

import { Copy, Ellipsis } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** The "…" menu with secondary actions of a page or card header, e.g. copying its ID. */
export function ActionsMenu({ children, className }: { children: ReactNode; className?: string }) {
	const t = useTranslations("common");

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type="button" variant="ghost" size="icon-sm" className={className} aria-label={t("moreActions")}>
					<Ellipsis />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-52">
				{children}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** Copies a value and confirms it with a toast, since the menu closes on select. */
export function CopyMenuItem({ value, label, copiedMessage }: { value: string; label: string; copiedMessage: string }) {
	const t = useTranslations("common");

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			toast.success(copiedMessage);
		} catch {
			toast.error(t("copyFailed"));
		}
	}

	return (
		<DropdownMenuItem onSelect={() => void copy()}>
			<Copy />
			{label}
		</DropdownMenuItem>
	);
}
