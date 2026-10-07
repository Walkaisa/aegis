"use client";

import { AEGIS_REPOSITORY_URL, type VersionStatusDto } from "@aegis/contracts";
import { ArrowRight, Check, ExternalLink, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ComponentProps, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { useAccount } from "@/components/dashboard/account-context";
import { Section } from "@/components/dashboard/page";
import { ErrorState, LoadingState } from "@/components/dashboard/states";
import { useVersionStatus } from "@/components/dashboard/version-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useDateFormat } from "@/lib/format";
import { cn } from "@/lib/utils";

const UPDATE_GUIDE_URL = `${AEGIS_REPOSITORY_URL}/blob/main/docs/installation.md#updates`;

function releaseUrl(version: string): string {
	return `${AEGIS_REPOSITORY_URL}/releases/tag/v${version}`;
}

/** The running version, the newest release and how to get there. */
export function VersionSettings() {
	const t = useTranslations("settings");
	const errorMessage = useErrorMessage();
	const { me } = useAccount();
	const { status, error, reload, check } = useVersionStatus();
	const [checking, setChecking] = useState(false);

	async function onCheck() {
		setChecking(true);
		try {
			const result = await check();
			if (result.checkFailed) {
				toast.error(t("updateCheckFailed"));
			} else if (result.updateAvailable && result.latest) {
				toast.info(t("updateFound", { version: result.latest.version }));
			} else {
				toast.success(t("upToDateToast"));
			}
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setChecking(false);
		}
	}

	const canCheck = status?.checkEnabled && me.permissions.includes("settings:manage");

	return (
		<Section
			id="version"
			title={
				<span className="flex flex-wrap items-center gap-2">
					{t("version")}
					{status ? <VersionBadge status={status} /> : null}
				</span>
			}
			description={status?.checkEnabled === false ? t("versionDescriptionOff") : t("versionDescription")}
			footer={
				status ? (
					<div className="flex w-full items-center justify-between gap-4">
						<CheckSummary status={status} />
						{canCheck ? (
							<Button variant="outline" size="sm" className="shrink-0" disabled={checking} onClick={() => void onCheck()}>
								{checking ? <Spinner /> : <RefreshCw />}
								{t("checkForUpdates")}
							</Button>
						) : null}
					</div>
				) : undefined
			}
		>
			{error ? (
				<ErrorState error={error} onRetry={() => void reload()} />
			) : !status ? (
				<LoadingState rows={1} className="h-28" />
			) : (
				<VersionComparison status={status} />
			)}
		</Section>
	);
}

/** Installed and newest version side by side, with the way to the update below them. */
function VersionComparison({ status }: { status: VersionStatusDto }) {
	const t = useTranslations("settings");
	const dates = useDateFormat();
	const { latest, updateAvailable } = status;
	const upToDate = latest !== null && !updateAvailable;

	return (
		<div className={cn("overflow-hidden rounded-xl border", updateAvailable && "border-primary/30")}>
			<div className="relative">
				<dl className="grid grid-cols-2">
					<VersionTile label={t("installedVersion")} version={status.current}>
						<a
							href={releaseUrl(status.current)}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1 underline-offset-4 transition-colors hover:text-foreground hover:underline"
						>
							{t("releaseNotes")}
							<ExternalLink className="size-3" />
						</a>
					</VersionTile>
					<VersionTile
						label={t("latestVersion")}
						version={latest?.version ?? "–"}
						highlight={updateAvailable}
						className="border-l"
					>
						{latest ? t("releasedOn", { date: dates.date(latest.publishedAt) }) : t("latestUnknown")}
					</VersionTile>
				</dl>
				{updateAvailable || upToDate ? (
					<span
						aria-hidden="true"
						className={cn(
							"absolute top-1/2 left-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-card shadow-xs",
							updateAvailable ? "border-primary/40 text-primary" : "border-success/40 text-success",
						)}
					>
						{updateAvailable ? <ArrowRight className="size-3.5" /> : <Check className="size-3.5" />}
					</span>
				) : null}
			</div>

			{updateAvailable && latest ? (
				<div className="flex flex-col gap-3 border-t border-primary/20 bg-linear-to-br from-primary/10 via-primary/5 to-transparent p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
					<div className="flex min-w-0 flex-col gap-0.5">
						<p className="text-sm font-medium">{t("updateAvailableTitle", { version: latest.version })}</p>
						<p className="text-xs text-pretty text-muted-foreground">{t("updateAvailableDescription")}</p>
					</div>
					<div className="grid shrink-0 gap-2 sm:flex">
						<Button size="sm" asChild>
							<ExternalAnchor href={latest.url}>{t("viewRelease")}</ExternalAnchor>
						</Button>
						<Button size="sm" variant="outline" className="bg-card" asChild>
							<ExternalAnchor href={UPDATE_GUIDE_URL}>{t("updateGuide")}</ExternalAnchor>
						</Button>
					</div>
				</div>
			) : null}
		</div>
	);
}

function VersionTile({
	label,
	version,
	highlight = false,
	className,
	children,
}: {
	label: ReactNode;
	version: string;
	highlight?: boolean;
	className?: string;
	children: ReactNode;
}) {
	return (
		<div className={cn("flex min-w-0 flex-col gap-1 p-4 sm:px-5", highlight && "bg-primary/5", className)}>
			<dt className="text-xs font-medium text-muted-foreground">{label}</dt>
			<dd className={cn("text-2xl leading-8 font-semibold tracking-tight tabular-nums", highlight && "text-primary")}>{version}</dd>
			<dd className="text-xs text-pretty text-muted-foreground">{children}</dd>
		</div>
	);
}

/** When the last check ran, or why there is none. */
function CheckSummary({ status }: { status: VersionStatusDto }) {
	const t = useTranslations("settings");
	const dates = useDateFormat();

	let summary: string;
	if (!status.checkEnabled) {
		summary = t("updateCheckDisabled");
	} else if (status.checkFailed) {
		summary = status.checkedAt ? t("updateCheckFailedSince", { time: dates.relative(status.checkedAt) }) : t("updateCheckFailed");
	} else if (status.checkedAt) {
		summary = t("lastChecked", { time: dates.relative(status.checkedAt) });
	} else {
		summary = t("updateCheckPending");
	}

	return <p className="min-w-0 flex-1 text-xs text-pretty text-muted-foreground">{summary}</p>;
}

function VersionBadge({ status }: { status: VersionStatusDto }) {
	const t = useTranslations("settings");

	if (status.updateAvailable) {
		return <Badge>{t("updateAvailable")}</Badge>;
	}
	if (!status.checkEnabled) {
		return <Badge variant="secondary">{t("updateCheckOff")}</Badge>;
	}
	if (status.checkFailed) {
		return <Badge variant="destructive">{t("updateCheckError")}</Badge>;
	}
	if (status.checkedAt) {
		return <Badge className="bg-success/10 text-success dark:bg-success/15">{t("upToDate")}</Badge>;
	}
	return <Badge variant="secondary">{t("notCheckedYet")}</Badge>;
}

/** A link to GitHub, opened in a new tab; styled by the button it is rendered into. */
function ExternalAnchor({ children, ...props }: ComponentProps<"a">) {
	return (
		<a target="_blank" rel="noopener noreferrer" {...props}>
			{children}
			<ExternalLink />
		</a>
	);
}
