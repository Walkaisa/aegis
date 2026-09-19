"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function useCopyToClipboard() {
	const t = useTranslations("common");
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) {
			return;
		}
		const timer = setTimeout(() => setCopied(false), 2000);
		return () => clearTimeout(timer);
	}, [copied]);

	const copy = useCallback(
		async (value: string) => {
			try {
				await navigator.clipboard.writeText(value);
				setCopied(true);
			} catch {
				toast.error(t("copyFailed"));
			}
		},
		[t],
	);

	return { copied, copy };
}

export function CopyButton({ value, label, size = "icon-sm" }: { value: string; label?: string; size?: "icon-sm" | "icon-xs" }) {
	const t = useTranslations("common");
	const { copied, copy } = useCopyToClipboard();
	const text = copied ? t("copied") : (label ?? t("copy"));

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button type="button" variant="ghost" size={size} aria-label={text} onClick={() => void copy(value)}>
					{copied ? <Check /> : <Copy />}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{text}</TooltipContent>
		</Tooltip>
	);
}

/** Read-only value with a copy action, e.g. client IDs, secrets and endpoint URLs. */
export function CopyField({ id, value, className, mono = true }: { id?: string; value: string; className?: string; mono?: boolean }) {
	const t = useTranslations("common");
	const { copied, copy } = useCopyToClipboard();

	return (
		<InputGroup className={className}>
			<InputGroupInput
				id={id}
				value={value}
				readOnly
				spellCheck={false}
				className={cn(mono && "font-mono text-xs")}
				onFocus={(event) => event.currentTarget.select()}
			/>
			<InputGroupAddon align="inline-end">
				<InputGroupButton size="icon-xs" aria-label={copied ? t("copied") : t("copy")} onClick={() => void copy(value)}>
					{copied ? <Check /> : <Copy />}
				</InputGroupButton>
			</InputGroupAddon>
		</InputGroup>
	);
}
