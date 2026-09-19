"use client";

import {
	RECOVERY_CODE_COUNT,
	type RecoveryCodesResponse,
	type TwoFactorSetupResponse,
	type TwoFactorStatusDto,
	type TwoFactorStatusResponse,
	twoFactorConfirmSchema,
	twoFactorEnableSchema,
	twoFactorSetupSchema,
} from "@aegis/contracts";
import { KeyRound, RefreshCw, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useAccount } from "@/components/dashboard/account-context";
import { Section } from "@/components/dashboard/page";
import { ErrorState, LoadingState } from "@/components/dashboard/states";
import { FormField } from "@/components/form-field";
import { IconInput } from "@/components/icon-input";
import { PasswordInput } from "@/components/password-input";
import { StatusMessage } from "@/components/status-message";
import { AuthenticatorSetup } from "@/components/two-factor/authenticator-setup";
import { RecoveryCodeList } from "@/components/two-factor/recovery-code-list";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useApiQuery } from "@/hooks/use-api-query";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormErrors } from "@/hooks/use-form-errors";
import { ApiRequestError, api } from "@/lib/api";
import { useDateFormat } from "@/lib/format";
import { cn } from "@/lib/utils";

type Flow = "enable" | "disable" | "regenerate" | null;

/** Two-factor authentication of the signed-in account: status, setup, recovery codes and turning it off. */
export function TwoFactorSection() {
	const t = useTranslations("twoFactor");
	const dates = useDateFormat();
	const { me, update } = useAccount();
	const { data, error, reload, setData } = useApiQuery<TwoFactorStatusResponse>("/account/two-factor");
	const [flow, setFlow] = useState<Flow>(null);

	const applyStatus = (twoFactor: TwoFactorStatusDto) => {
		setData({ twoFactor });
		if (me.account.twoFactorEnabled !== twoFactor.enabled) {
			update({ ...me, account: { ...me.account, twoFactorEnabled: twoFactor.enabled } });
		}
	};

	const status = data?.twoFactor;
	const remaining = status?.recoveryCodesRemaining ?? 0;
	const lowOnCodes = status?.enabled && remaining <= 3;

	return (
		<section id="two-factor" className="scroll-mt-24">
			<Section title={t("title")} description={t("description")}>
				{error ? (
					<ErrorState error={error} onRetry={() => void reload()} />
				) : !status ? (
					<LoadingState rows={1} className="h-20" />
				) : (
					<div className="overflow-hidden rounded-xl border">
						<div className="flex flex-wrap items-center gap-4 p-4">
							<span
								className={cn(
									"flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset [&_svg]:size-5",
									status.enabled
										? "bg-success/12 text-success ring-success/20"
										: "bg-muted text-muted-foreground ring-foreground/5",
								)}
							>
								{status.enabled ? <ShieldCheck /> : <ShieldOff />}
							</span>
							<div className="flex min-w-48 flex-1 flex-col gap-0.5">
								<div className="flex flex-wrap items-center gap-2">
									<span className="font-medium">
										{status.enabled ? (status.label ?? t("authenticator")) : t("authenticator")}
									</span>
									<span
										className={cn(
											"inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
											status.enabled ? "bg-success/12 text-success" : "bg-muted text-muted-foreground",
										)}
									>
										{status.enabled ? t("enabled") : t("disabled")}
									</span>
								</div>
								<p className="text-sm text-pretty text-muted-foreground">
									{status.enabled && status.enabledAt
										? t("enabledSince", { date: dates.date(status.enabledAt) })
										: t("disabledHint")}
								</p>
							</div>
							{status.enabled ? (
								<Button variant="outline" onClick={() => setFlow("disable")}>
									<ShieldOff />
									{t("disable.action")}
								</Button>
							) : (
								<Button onClick={() => setFlow("enable")}>
									<ShieldCheck />
									{t("enable.action")}
								</Button>
							)}
						</div>

						{status.enabled ? (
							<div
								className={cn(
									"flex flex-wrap items-center gap-3 border-t px-4 py-3",
									lowOnCodes ? "bg-warning/8 dark:bg-warning/10" : "bg-muted/30",
								)}
							>
								<KeyRound className={cn("size-4 shrink-0", lowOnCodes ? "text-warning" : "text-muted-foreground")} />
								<p className="min-w-48 flex-1 text-sm">
									<span className="font-medium">
										{t("recoveryCodes.remaining", { count: remaining, total: RECOVERY_CODE_COUNT })}
									</span>
									{lowOnCodes ? <span className="text-muted-foreground"> · {t("recoveryCodes.low")}</span> : null}
								</p>
								<Button variant="ghost" size="sm" onClick={() => setFlow("regenerate")}>
									<RefreshCw />
									{t("regenerate.action")}
								</Button>
							</div>
						) : null}
					</div>
				)}
			</Section>

			{flow === "enable" ? <EnableDialog onClose={() => setFlow(null)} onEnabled={applyStatus} /> : null}
			{flow === "disable" || flow === "regenerate" ? (
				<ConfirmFactorDialog mode={flow} onClose={() => setFlow(null)} onChanged={applyStatus} />
			) : null}
		</section>
	);
}

function StepEyebrow({ step, total }: { step: number; total: number }) {
	const t = useTranslations("twoFactor");
	return (
		<div className="flex items-center gap-2">
			<span className="flex gap-1" aria-hidden="true">
				{Array.from({ length: total }, (_, index) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed number of steps
						key={index}
						className={cn("h-1 w-5 rounded-full transition-colors", index < step ? "bg-primary" : "bg-muted-foreground/20")}
					/>
				))}
			</span>
			<span className="text-xs font-medium text-muted-foreground">{t("step", { step, total })}</span>
		</div>
	);
}

/** Setup in three steps: confirm the password, connect the authenticator app, store the recovery codes. */
function EnableDialog({ onClose, onEnabled }: { onClose: () => void; onEnabled: (status: TwoFactorStatusDto) => void }) {
	const t = useTranslations("twoFactor");
	const tCommon = useTranslations("common");
	const errorMessage = useErrorMessage();
	const { me } = useAccount();
	const { errors, validate, applyApiError, setFieldError } = useFormErrors();
	const [password, setPassword] = useState("");
	const [code, setCode] = useState("");
	const [label, setLabel] = useState(() => t("authenticator"));
	const [setup, setSetup] = useState<TwoFactorSetupResponse | null>(null);
	const [issued, setIssued] = useState<RecoveryCodesResponse | null>(null);
	const [pending, setPending] = useState(false);

	const step = issued ? 3 : setup ? 2 : 1;

	async function close() {
		if (setup && !issued) {
			// A secret that was never confirmed must not linger.
			await api.delete("/account/two-factor/setup").catch(() => undefined);
		}
		onClose();
	}

	async function start(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const input = validate(twoFactorSetupSchema, { currentPassword: password });
		if (!input) {
			return;
		}
		setPending(true);
		try {
			setSetup(await api.post<TwoFactorSetupResponse>("/account/two-factor/setup", input));
			setPassword("");
		} catch (error) {
			if (error instanceof ApiRequestError && error.code === "invalid_current_password") {
				setFieldError("currentPassword", "current_password_invalid");
			} else if (!applyApiError(error)) {
				toast.error(errorMessage(error));
			}
		} finally {
			setPending(false);
		}
	}

	async function confirm(value: string) {
		const input = validate(twoFactorEnableSchema, { code: value, label });
		if (!input || pending) {
			return;
		}
		setPending(true);
		try {
			const result = await api.post<RecoveryCodesResponse>("/account/two-factor", input);
			setIssued(result);
			onEnabled(result.twoFactor);
			toast.success(t("enable.done"));
		} catch (error) {
			setCode("");
			if (error instanceof ApiRequestError && error.code === "second_factor_invalid") {
				setFieldError("code", "second_factor_invalid");
			} else if (!applyApiError(error)) {
				toast.error(errorMessage(error));
			}
		} finally {
			setPending(false);
		}
	}

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				// Once the codes are shown, the dialog only closes through the confirmation.
				if (!open && !pending && !issued) {
					void close();
				}
			}}
		>
			<DialogContent
				showCloseButton={!issued}
				className={cn(
					"max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto p-6 [&_[data-slot=dialog-footer]]:-mx-6 [&_[data-slot=dialog-footer]]:-mb-6 [&_[data-slot=dialog-footer]]:px-6",
					step === 2 ? "sm:max-w-2xl" : "sm:max-w-lg",
				)}
				onPointerDownOutside={(event) => event.preventDefault()}
				onEscapeKeyDown={(event) => issued && event.preventDefault()}
			>
				<DialogHeader className="gap-2">
					<StepEyebrow step={step} total={3} />
					<DialogTitle className="text-lg">{t(`enable.steps.${step}.title`)}</DialogTitle>
					<DialogDescription>{t(`enable.steps.${step}.description`)}</DialogDescription>
				</DialogHeader>

				{step === 1 ? (
					<form onSubmit={start} noValidate className="flex flex-col gap-6">
						<FormField id="two-factor-password" label={t("currentPassword")} error={errors.currentPassword}>
							<PasswordInput
								id="two-factor-password"
								autoComplete="current-password"
								autoFocus
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								aria-invalid={errors.currentPassword ? true : undefined}
							/>
						</FormField>
						<DialogFooter>
							<Button type="button" variant="outline" disabled={pending} onClick={() => void close()}>
								{tCommon("cancel")}
							</Button>
							<Button type="submit" disabled={pending}>
								{pending ? <Spinner /> : null}
								{t("enable.continue")}
							</Button>
						</DialogFooter>
					</form>
				) : null}

				{step === 2 && setup ? (
					<form
						onSubmit={(event) => {
							event.preventDefault();
							void confirm(code);
						}}
						noValidate
						className="flex flex-col gap-6"
					>
						<AuthenticatorSetup
							setup={setup}
							label={label}
							onLabelChange={setLabel}
							labelError={errors.label}
							code={code}
							onCodeChange={setCode}
							onComplete={(value) => void confirm(value)}
							error={errors.code}
							disabled={pending}
						/>

						<DialogFooter>
							<Button type="button" variant="outline" disabled={pending} onClick={() => void close()}>
								{tCommon("cancel")}
							</Button>
							<Button type="submit" disabled={pending || code.length === 0}>
								{pending ? <Spinner /> : null}
								{t("enable.submit")}
							</Button>
						</DialogFooter>
					</form>
				) : null}

				{step === 3 && issued ? (
					<IssuedCodes codes={issued.codes} accountName={me.account.email} instanceName={me.instanceName} onDone={onClose} />
				) : null}
			</DialogContent>
		</Dialog>
	);
}

/** The freshly issued recovery codes; closing requires confirming they are stored. */
function IssuedCodes({
	codes,
	accountName,
	instanceName,
	onDone,
}: {
	codes: string[];
	accountName: string;
	instanceName: string;
	onDone: () => void;
}) {
	const t = useTranslations("twoFactor.recoveryCodes");
	const tCommon = useTranslations("common");
	const [confirmed, setConfirmed] = useState(false);

	return (
		<div className="flex flex-col gap-5">
			<StatusMessage tone="warning" title={t("warningTitle")}>
				{t("warning")}
			</StatusMessage>
			<RecoveryCodeList codes={codes} accountName={accountName} instanceName={instanceName} />
			<FieldGroup>
				<Field orientation="horizontal">
					<Checkbox
						id="recovery-codes-stored"
						checked={confirmed}
						onCheckedChange={(checked) => setConfirmed(checked === true)}
					/>
					<FieldLabel htmlFor="recovery-codes-stored" className="font-normal">
						{t("confirm")}
					</FieldLabel>
				</Field>
			</FieldGroup>
			<DialogFooter>
				<Button disabled={!confirmed} onClick={onDone}>
					{tCommon("done")}
				</Button>
			</DialogFooter>
		</div>
	);
}

/** Turning two-factor authentication off and replacing the recovery codes both require password and code. */
function ConfirmFactorDialog({
	mode,
	onClose,
	onChanged,
}: {
	mode: "disable" | "regenerate";
	onClose: () => void;
	onChanged: (status: TwoFactorStatusDto) => void;
}) {
	const t = useTranslations("twoFactor");
	const tCommon = useTranslations("common");
	const errorMessage = useErrorMessage();
	const { me } = useAccount();
	const { errors, validate, applyApiError, setFieldError } = useFormErrors();
	const [values, setValues] = useState({ currentPassword: "", code: "" });
	const [pending, setPending] = useState(false);
	const [issued, setIssued] = useState<string[] | null>(null);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const input = validate(twoFactorConfirmSchema, values);
		if (!input) {
			return;
		}
		setPending(true);
		try {
			if (mode === "disable") {
				const result = await api.post<TwoFactorStatusResponse>("/account/two-factor/disable", input);
				onChanged(result.twoFactor);
				toast.success(t("disable.done"));
				onClose();
			} else {
				const result = await api.post<RecoveryCodesResponse>("/account/two-factor/recovery-codes", input);
				onChanged(result.twoFactor);
				setIssued(result.codes);
				toast.success(t("regenerate.done"));
			}
		} catch (error) {
			if (error instanceof ApiRequestError && error.code === "invalid_current_password") {
				setFieldError("currentPassword", "current_password_invalid");
			} else if (error instanceof ApiRequestError && error.code === "second_factor_invalid") {
				setFieldError("code", "second_factor_invalid");
				setValues((current) => ({ ...current, code: "" }));
			} else if (!applyApiError(error)) {
				toast.error(errorMessage(error));
			}
		} finally {
			setPending(false);
		}
	}

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !pending && !issued) {
					onClose();
				}
			}}
		>
			<DialogContent
				showCloseButton={!issued}
				className="sm:max-w-lg"
				onPointerDownOutside={(event) => issued && event.preventDefault()}
				onEscapeKeyDown={(event) => issued && event.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle>{issued ? t("recoveryCodes.newTitle") : t(`${mode}.title`)}</DialogTitle>
					<DialogDescription>{issued ? t("recoveryCodes.newDescription") : t(`${mode}.description`)}</DialogDescription>
				</DialogHeader>

				{issued ? (
					<IssuedCodes codes={issued} accountName={me.account.email} instanceName={me.instanceName} onDone={onClose} />
				) : (
					<form onSubmit={submit} noValidate className="flex flex-col gap-6">
						<FieldGroup>
							<FormField id="confirm-factor-password" label={t("currentPassword")} error={errors.currentPassword}>
								<PasswordInput
									id="confirm-factor-password"
									autoComplete="current-password"
									autoFocus
									value={values.currentPassword}
									onChange={(event) => setValues((current) => ({ ...current, currentPassword: event.target.value }))}
									aria-invalid={errors.currentPassword ? true : undefined}
								/>
							</FormField>
							<FormField
								id="confirm-factor-code"
								label={t("codeLabel")}
								description={t("codeDescription")}
								error={errors.code}
							>
								<IconInput
									id="confirm-factor-code"
									icon={<Smartphone />}
									className="[&_input]:font-mono [&_input]:tracking-wider"
									autoComplete="one-time-code"
									spellCheck={false}
									placeholder="123456"
									value={values.code}
									onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))}
									aria-invalid={errors.code ? true : undefined}
								/>
							</FormField>
						</FieldGroup>
						{mode === "disable" ? (
							<StatusMessage tone="warning" title={t("disable.warningTitle")}>
								{t("disable.warning")}
							</StatusMessage>
						) : null}
						<DialogFooter>
							<Button type="button" variant="outline" disabled={pending} onClick={onClose}>
								{tCommon("cancel")}
							</Button>
							<Button type="submit" variant={mode === "disable" ? "destructive" : "default"} disabled={pending}>
								{pending ? <Spinner /> : null}
								{t(`${mode}.submit`)}
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
