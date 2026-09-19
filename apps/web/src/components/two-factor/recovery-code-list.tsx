"use client";

import { Check, Copy, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Recovery codes in a two-column grid, with copy and download as a text file. */
export function RecoveryCodeList({ codes, accountName, instanceName }: { codes: string[]; accountName: string; instanceName: string }) {
	const t = useTranslations("twoFactor.recoveryCodes");
	const tCommon = useTranslations("common");
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) {
			return;
		}
		const timer = setTimeout(() => setCopied(false), 2000);
		return () => clearTimeout(timer);
	}, [copied]);

	async function copy() {
		try {
			await navigator.clipboard.writeText(codes.join("\n"));
			setCopied(true);
		} catch {
			toast.error(tCommon("copyFailed"));
		}
	}

	function download() {
		const lines = [
			t("file.heading", { instance: instanceName }),
			"",
			`${t("file.account")}: ${accountName}`,
			`${t("file.origin")}: ${window.location.origin}`,
			`${t("file.created")}: ${new Date().toLocaleString()}`,
			"",
			t("file.usage"),
			"",
			...codes.map((code, index) => `${String(index + 1).padStart(2, " ")}. ${code}`),
			"",
		];
		const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
		const link = document.createElement("a");
		link.href = url;
		link.download = `${instanceName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "aegis"}-recovery-codes.txt`;
		link.click();
		URL.revokeObjectURL(url);
	}

	return (
		<div className="flex flex-col gap-3">
			<ol className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-xl border bg-muted/30 px-5 py-4">
				{codes.map((code, index) => (
					<li key={code} className="flex items-baseline gap-2.5">
						<span className="w-4 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{index + 1}</span>
						<span className="font-mono text-sm tracking-wider select-all">{code}</span>
					</li>
				))}
			</ol>
			<div className="grid grid-cols-2 gap-2">
				<Button type="button" variant="outline" onClick={() => void copy()}>
					{copied ? <Check /> : <Copy />}
					{copied ? tCommon("copied") : t("copy")}
				</Button>
				<Button type="button" variant="outline" onClick={download}>
					<Download />
					{t("download")}
				</Button>
			</div>
		</div>
	);
}
