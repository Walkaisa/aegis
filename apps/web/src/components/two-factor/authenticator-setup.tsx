"use client";

import { TOTP_LABEL_MAX_LENGTH, type TwoFactorSetupResponse } from "@aegis/contracts";
import { KeyRound, ScanLine, ShieldCheck, Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/copy-button";
import { OneTimeCodeInput } from "@/components/two-factor/one-time-code-input";
import { QrCode } from "@/components/two-factor/qr-code";
import { Input } from "@/components/ui/input";

/** Breaks the base32 secret into groups of four for manual entry. */
function groupSecret(secret: string): string[] {
	return secret.match(/.{1,4}/g) ?? [secret];
}

/**
 * Connecting an authenticator app: QR code, the key for manual entry, a name to recognize the app by
 * and the first code to confirm.
 */
export function AuthenticatorSetup({
	setup,
	label,
	onLabelChange,
	labelError,
	code,
	onCodeChange,
	onComplete,
	error,
	disabled,
}: {
	setup: TwoFactorSetupResponse;
	label: string;
	onLabelChange: (value: string) => void;
	labelError?: string;
	code: string;
	onCodeChange: (value: string) => void;
	onComplete: (value: string) => void;
	error?: string;
	disabled?: boolean;
}) {
	const t = useTranslations("twoFactor");

	return (
		<ol className="flex flex-col gap-3">
			<li className="flex flex-col items-center gap-5 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center">
				<div className="shrink-0 rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5">
					<QrCode value={setup.otpauthUri} label={t("enable.qrLabel")} className="size-40 rounded-none p-0" />
				</div>
				<StepContent index={1} icon={<ScanLine />} title={t("enable.scanTitle")} description={t("enable.scan")}>
					<dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 border-t pt-3">
						<dt className="text-muted-foreground">{t("enable.account")}</dt>
						<dd className="truncate font-medium" title={setup.accountName}>
							{setup.accountName}
						</dd>
						<dt className="text-muted-foreground">{t("enable.issuer")}</dt>
						<dd className="truncate font-medium">{setup.issuer}</dd>
					</dl>
				</StepContent>
			</li>

			<li className="rounded-xl border bg-muted/20 p-4">
				<StepContent index={2} icon={<KeyRound />} title={t("enable.manualTitle")} description={t("enable.manual")}>
					<div className="flex items-center gap-2 rounded-lg border bg-background py-1.5 pr-1.5 pl-3.5 dark:bg-input/30">
						<code className="flex min-w-0 flex-1 flex-wrap gap-x-2.5 gap-y-1 font-mono text-sm font-medium tracking-[0.12em] select-all">
							{groupSecret(setup.secret).map((group, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: groups of a fixed secret
								<span key={index}>{group}</span>
							))}
						</code>
						<CopyButton value={setup.secret} label={t("enable.copyKey")} />
					</div>
				</StepContent>
			</li>

			<li className="rounded-xl border bg-muted/20 p-4">
				<StepContent
					index={3}
					icon={<Tag />}
					title={t("enable.labelTitle")}
					titleFor="two-factor-label"
					description={t("enable.labelDescription")}
				>
					<Input
						id="two-factor-label"
						value={label}
						onChange={(event) => onLabelChange(event.target.value)}
						maxLength={TOTP_LABEL_MAX_LENGTH}
						autoComplete="off"
						spellCheck={false}
						placeholder={t("enable.labelPlaceholder")}
						aria-invalid={labelError ? true : undefined}
						aria-describedby={labelError ? "two-factor-label-error" : undefined}
						disabled={disabled}
						className="max-w-80 bg-background"
					/>
					{labelError ? (
						<p id="two-factor-label-error" className="text-sm text-destructive">
							{labelError}
						</p>
					) : null}
				</StepContent>
			</li>

			<li className="rounded-xl border bg-muted/20 p-4">
				<StepContent
					index={4}
					icon={<ShieldCheck />}
					title={t("enable.codeLabel")}
					titleFor="two-factor-code"
					description={t("enable.codeDescription")}
				>
					<OneTimeCodeInput
						id="two-factor-code"
						value={code}
						onChange={onCodeChange}
						onComplete={onComplete}
						aria-invalid={error ? true : undefined}
						aria-describedby={error ? "two-factor-code-error" : undefined}
						disabled={disabled}
						autoFocus
					/>
					{error ? (
						<p id="two-factor-code-error" className="text-sm text-destructive">
							{error}
						</p>
					) : null}
				</StepContent>
			</li>
		</ol>
	);
}

/** A numbered step: accent icon beside title and description, its content aligned with the text. */
function StepContent({
	index,
	icon,
	title,
	titleFor,
	description,
	children,
}: {
	index: number;
	icon: ReactNode;
	title: string;
	titleFor?: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<div className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-3">
			<span className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15 ring-inset [&_svg]:size-4.5">
				{icon}
				<span className="absolute -top-1.5 -right-1.5 flex size-4.5 items-center justify-center rounded-full bg-primary text-[0.625rem] font-semibold text-primary-foreground ring-2 ring-popover">
					{index}
				</span>
			</span>
			<div className="flex min-w-0 flex-col gap-1 pt-0.5">
				{titleFor ? (
					<label htmlFor={titleFor} className="font-medium">
						{title}
					</label>
				) : (
					<p className="font-medium">{title}</p>
				)}
				<p className="text-pretty text-muted-foreground">{description}</p>
			</div>
			{/* On small screens the content takes the full width; from sm on it lines up with the text. */}
			<div className="col-span-2 flex min-w-0 flex-col gap-2 sm:col-span-1 sm:col-start-2">{children}</div>
		</div>
	);
}
