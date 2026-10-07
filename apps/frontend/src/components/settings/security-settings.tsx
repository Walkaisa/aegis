"use client";

import type { SecurityOverviewDto } from "@aegis/contracts";
import { CircleCheck, KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CopyButton } from "@/components/copy-button";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { Section } from "@/components/dashboard/page";
import { ErrorState, LoadingState } from "@/components/dashboard/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api";
import { useDateFormat } from "@/lib/format";

const PROTECTIONS = ["roles", "applicationAccess", "pkce", "redirectUris", "codeFlow", "argon2", "encryption", "rateLimit"] as const;

/** Signing keys and the safeguards that always apply. */
export function SecuritySettings() {
	const t = useTranslations("settings");
	const dates = useDateFormat();
	const { data, error, reload, setData } = useApiQuery<SecurityOverviewDto>("/settings/keys");

	async function rotate() {
		setData(await api.post<SecurityOverviewDto>("/settings/keys/rotate"));
		toast.success(t("keyRotated"));
	}

	return (
		<>
			<Section
				title={t("keys")}
				description={t("keysDescription")}
				action={
					data ? (
						<ConfirmDialog
							trigger={
								<Button variant="destructive" size="sm">
									{t("rotateKey")}
								</Button>
							}
							title={t("rotateKeyTitle")}
							description={t("rotateKeyDescription", { days: data.retiredKeyRetentionDays })}
							confirmLabel={t("rotateKeyConfirm")}
							destructive
							onConfirm={rotate}
						/>
					) : undefined
				}
			>
				{error ? (
					<ErrorState error={error} onRetry={() => void reload()} />
				) : !data ? (
					<LoadingState rows={2} className="h-14" />
				) : (
					<div className="space-y-4">
						<div className="grid gap-3">
							{data.signingKeys.map((key) => (
								<article
									key={key.kid}
									className="overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-sm ring-1 ring-border/60"
								>
									<div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
										<div className="flex min-w-0 items-center gap-3">
											<span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary/15 via-primary/10 to-transparent text-primary ring-1 ring-primary/20 ring-inset">
												<KeyRound className="size-5" />
											</span>
											<div className="min-w-0">
												<div className="flex flex-wrap items-center gap-2">
													<Badge variant={key.status === "active" ? "default" : "secondary"}>
														{t(key.status)}
													</Badge>
													<Badge variant="outline">{key.alg}</Badge>
												</div>
												<p className="mt-2 text-xs text-muted-foreground">
													{key.retiredAt
														? t("retiredAt", { date: dates.dateTime(key.retiredAt) })
														: t("createdAt", { date: dates.dateTime(key.createdAt) })}
												</p>
											</div>
										</div>
									</div>

									<div className="border-t border-border/60 bg-background/60 px-3 py-3 sm:px-4">
										<div className="flex min-w-0 items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-3 py-2">
											<code
												className="min-w-0 flex-1 break-all font-mono text-[11px] leading-relaxed text-foreground/90 sm:text-xs"
												title={key.kid}
											>
												{key.kid}
											</code>
											<div className="shrink-0">
												<CopyButton value={key.kid} size="icon-xs" />
											</div>
										</div>
									</div>
								</article>
							))}
						</div>
						<div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
							{t("retention", { days: data.retiredKeyRetentionDays })}
						</div>
					</div>
				)}
			</Section>

			<Section title={t("protections")} description={t("protectionsDescription")}>
				<ul className="grid gap-3 sm:grid-cols-2">
					{PROTECTIONS.map((key) => (
						<li key={key} className="flex items-start gap-2.5 text-sm">
							<CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />
							<span>
								{t(`protectionItems.${key}`, {
									memory: data ? Math.round(data.argon2.memoryKiB / 1024) : 64,
									iterations: data?.argon2.iterations ?? 3,
									parallelism: data?.argon2.parallelism ?? 4,
								})}
							</span>
						</li>
					))}
				</ul>
			</Section>
		</>
	);
}
