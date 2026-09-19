"use client";

import { AUDIT_RETENTION_OPTIONS, type InstanceSettingsDto } from "@aegis/contracts";
import { Check, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useErrorMessage } from "@/hooks/use-error-message";
import { api } from "@/lib/api";

/** Changes how long audit events are kept. The maintenance run removes anything older. */
export function AuditRetentionMenu({ days, onChanged }: { days: number; onChanged: (days: number) => void }) {
	const t = useTranslations("audit.retention");
	const errorMessage = useErrorMessage();
	const [pending, setPending] = useState(false);

	async function choose(next: number) {
		if (next === days || pending) {
			return;
		}
		setPending(true);
		try {
			const saved = await api.patch<InstanceSettingsDto>("/settings", { auditRetentionDays: next });
			onChanged(saved.auditRetentionDays);
			toast.success(t("saved", { days: next }));
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setPending(false);
		}
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type="button" variant="ghost" size="sm" disabled={pending}>
					<Clock />
					{t("label", { days })}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuGroup>
					<DropdownMenuLabel>{t("title")}</DropdownMenuLabel>
					{AUDIT_RETENTION_OPTIONS.map((option) => (
						<DropdownMenuItem key={option} onClick={() => void choose(option)}>
							{option === days ? <Check /> : <span className="size-4" aria-hidden="true" />}
							{t("option", { days: option })}
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
