"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Floats at the bottom of a form while it has unsaved changes. Rendered as the last child of the
 * `<form>`, so its save button submits it.
 */
export function UnsavedChangesBar({
	saving,
	disabled = false,
	hint,
	onDiscard,
}: {
	saving: boolean;
	disabled?: boolean;
	hint?: ReactNode;
	onDiscard: () => void;
}) {
	const t = useTranslations("common");

	return (
		<div className="sticky bottom-4 z-10 flex animate-in flex-col gap-3 rounded-xl border bg-card/95 p-3 pl-4 shadow-lg backdrop-blur fade-in slide-in-from-bottom-2 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex min-w-0 flex-col gap-0.5">
				<span className="text-sm font-medium">{t("unsavedChanges")}</span>
				{hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
			</div>
			<div className="flex shrink-0 gap-2 sm:justify-end">
				<Button type="button" variant="ghost" disabled={saving || disabled} onClick={onDiscard}>
					{t("discard")}
				</Button>
				<Button type="submit" disabled={saving || disabled}>
					{saving ? <Spinner /> : null}
					{t("saveChanges")}
				</Button>
			</div>
		</div>
	);
}
