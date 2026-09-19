"use client";

import type { SecurityOverviewDto } from "@aegis/contracts";
import { CircleCheck, KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { Section } from "@/components/dashboard/page";
import { ErrorState, LoadingState } from "@/components/dashboard/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from "@/components/ui/item";
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
								<Button variant="outline" size="sm">
									{t("rotateKey")}
								</Button>
							}
							title={t("rotateKeyTitle")}
							description={t("rotateKeyDescription")}
							confirmLabel={t("rotateKeyConfirm")}
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
					<div className="flex flex-col gap-4">
						<ItemGroup>
							{data.signingKeys.map((key, index) => (
								<Fragment key={key.kid}>
									{index > 0 ? <ItemSeparator /> : null}
									<Item size="sm" className="px-0">
										<ItemMedia variant="icon">
											<KeyRound />
										</ItemMedia>
										<ItemContent className="min-w-0">
											<ItemTitle className="flex-wrap">
												<span className="truncate font-mono text-xs">{key.kid}</span>
												<Badge variant="outline">{key.alg}</Badge>
												<Badge variant={key.status === "active" ? "default" : "secondary"}>{t(key.status)}</Badge>
											</ItemTitle>
											<ItemDescription>
												{key.retiredAt
													? t("retiredAt", { date: dates.dateTime(key.retiredAt) })
													: t("createdAt", { date: dates.dateTime(key.createdAt) })}
											</ItemDescription>
										</ItemContent>
									</Item>
								</Fragment>
							))}
						</ItemGroup>
						<p className="text-xs text-muted-foreground">{t("retention", { days: data.retiredKeyRetentionDays })}</p>
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
