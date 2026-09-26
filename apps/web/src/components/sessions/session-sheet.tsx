"use client";

import type { SessionDto } from "@aegis/contracts";
import { AppWindow, ChevronRight, LogOut } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AppAvatar } from "@/components/app-avatar";
import { CopyButton } from "@/components/copy-button";
import {
	DetailSheet,
	DetailSheetBody,
	DetailSheetFact,
	DetailSheetFacts,
	DetailSheetFooter,
	DetailSheetHeader,
	DetailSheetIcon,
	DetailSheetRaw,
	DetailSheetSection,
} from "@/components/dashboard/detail-sheet";
import { DeviceIcon, useDeviceLabel } from "@/components/dashboard/device";
import { SecondFactorBadge } from "@/components/sessions/second-factor-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleBadge, UserAvatar } from "@/components/users/account-badges";
import { useDateFormat } from "@/lib/format";

/** Everything about one session in a side panel, with the action to end it. */
export function SessionSheet({
	session,
	onClose,
	onRevoke,
}: {
	/** The session shown; `null` closes the panel. */
	session: SessionDto | null;
	onClose: () => void;
	onRevoke: (session: SessionDto) => void;
}) {
	return (
		<DetailSheet item={session} onClose={onClose}>
			{(shown) => <SessionPanel session={shown} onRevoke={onRevoke} />}
		</DetailSheet>
	);
}

function SessionPanel({ session, onRevoke }: { session: SessionDto; onRevoke: (session: SessionDto) => void }) {
	const t = useTranslations("sessions");
	const dates = useDateFormat();
	const deviceLabel = useDeviceLabel();

	return (
		<>
			<DetailSheetHeader
				icon={
					<DetailSheetIcon>
						<DeviceIcon userAgent={session.userAgent} />
					</DetailSheetIcon>
				}
				title={deviceLabel(session.userAgent)}
				description={
					<>
						<span title={dates.dateTime(session.lastSeenAt)}>
							{t("lastActive", { time: dates.relative(session.lastSeenAt) })}
						</span>
						{session.current ? <Badge>{t("current")}</Badge> : null}
					</>
				}
			/>

			<DetailSheetBody>
				<DetailSheetSection title={t("panel.account")}>
					<Link
						href={`/users/${session.account.id}`}
						className="group/account flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50"
					>
						<UserAvatar name={session.account.displayName} src={session.account.avatarUrl} />
						<div className="flex min-w-0 flex-1 flex-col">
							<span className="truncate text-sm font-medium">{session.account.displayName}</span>
							<span className="truncate text-xs text-muted-foreground">{session.account.email}</span>
						</div>
						<RoleBadge role={session.account.role} className="hidden min-[380px]:inline-flex" />
						<ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/account:translate-x-0.5" />
					</Link>
				</DetailSheetSection>

				<DetailSheetSection title={t("panel.session")}>
					<DetailSheetFacts>
						<DetailSheetFact label={t("columns.signIn")}>
							{session.secondFactor ? <SecondFactorBadge /> : t("passwordOnly")}
						</DetailSheetFact>
						<DetailSheetFact label={t("columns.signedInAt")}>{dates.dateTime(session.authenticatedAt)}</DetailSheetFact>
						<DetailSheetFact label={t("columns.expiresAt")}>{dates.dateTime(session.expiresAt)}</DetailSheetFact>
						<DetailSheetFact label={t("columns.ipAddress")}>
							{session.ipAddress ? (
								<>
									<code className="min-w-0 font-mono text-xs break-all">{session.ipAddress}</code>
									<CopyButton value={session.ipAddress} size="icon-xs" />
								</>
							) : (
								"–"
							)}
						</DetailSheetFact>
					</DetailSheetFacts>
					{session.userAgent ? <DetailSheetRaw>{session.userAgent}</DetailSheetRaw> : null}
				</DetailSheetSection>

				<DetailSheetSection title={t("panel.applications", { count: session.applications.length })}>
					{session.applications.length === 0 ? (
						<p className="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
							{t("noApplications")}
						</p>
					) : (
						<ul className="divide-y rounded-xl border bg-card">
							{session.applications.map((application) => (
								<li key={application.id}>
									<Link
										href={`/applications/${application.id}`}
										className="group/app flex items-center gap-3 px-3 py-2.5 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted/50"
									>
										{application.logoUrl ? (
											<AppAvatar name={application.name} src={application.logoUrl} size="sm" />
										) : (
											<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
												<AppWindow className="size-4" />
											</span>
										)}
										<div className="flex min-w-0 flex-1 flex-col">
											<span className="truncate text-sm font-medium">{application.name}</span>
											<span
												className="truncate text-xs text-muted-foreground"
												title={dates.dateTime(application.lastAuthorizedAt)}
											>
												{t("panel.lastSignIn", { time: dates.relative(application.lastAuthorizedAt) })}
											</span>
										</div>
										<ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/app:translate-x-0.5" />
									</Link>
								</li>
							))}
						</ul>
					)}
				</DetailSheetSection>
			</DetailSheetBody>

			<DetailSheetFooter>
				<Button variant="destructive" onClick={() => onRevoke(session)}>
					<LogOut />
					{t("panel.revoke")}
				</Button>
			</DetailSheetFooter>
		</>
	);
}
