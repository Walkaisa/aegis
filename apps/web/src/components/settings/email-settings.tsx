"use client";

import {
	type EmailSettingsDto,
	type EmailSettingsRequest,
	type EmailTestResponse,
	emailSettingsSchema,
	SMTP_DEFAULT_PORTS,
	SMTP_SECURITY_MODES,
	type SmtpSecurity,
} from "@aegis/contracts";
import { ChevronDown, MailCheck, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Section } from "@/components/dashboard/page";
import { ErrorState } from "@/components/dashboard/states";
import { FormField } from "@/components/form-field";
import { PasswordInput } from "@/components/password-input";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { UnsavedChangesBar } from "@/components/unsaved-changes-bar";
import { useApiQuery } from "@/hooks/use-api-query";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormErrors } from "@/hooks/use-form-errors";
import { ApiRequestError, api } from "@/lib/api";
import { useDateFormat } from "@/lib/format";

/**
 * The SMTP configuration, connection test and sending controls. The form is laid out before the
 * stored settings arrive, so loading them never moves anything on the page.
 */
export function EmailSettings() {
	const t = useTranslations("emailSettings");
	const { data, error, reload, setData } = useApiQuery<EmailSettingsDto>("/settings/email");

	if (error) {
		return (
			<Section title={t("title")} description={t("description")}>
				<ErrorState error={error} onRetry={() => void reload()} />
			</Section>
		);
	}
	return <EmailForm key={data ? "loaded" : "loading"} settings={data ?? null} onSaved={setData} />;
}

/** The form state mirrors the request, with the password kept apart: empty means "leave it alone". */
interface FormValues {
	enabled: boolean;
	host: string;
	port: string;
	security: SmtpSecurity;
	username: string;
	password: string;
	fromName: string;
	fromAddress: string;
	replyTo: string;
	allowInvalidCertificate: boolean;
}

function toFormValues(settings: EmailSettingsDto | null): FormValues {
	return {
		enabled: settings?.enabled ?? false,
		host: settings?.host ?? "",
		port: String(settings?.port ?? SMTP_DEFAULT_PORTS.starttls),
		security: settings?.security ?? "starttls",
		username: settings?.username ?? "",
		password: "",
		fromName: settings?.fromName ?? "",
		fromAddress: settings?.fromAddress ?? "",
		replyTo: settings?.replyTo ?? "",
		allowInvalidCertificate: settings?.allowInvalidCertificate ?? false,
	};
}

/** The stored password is only sent to the server it was entered for; see `emailSettingsSchema`. */
function isSameServer(settings: EmailSettingsDto, values: FormValues): boolean {
	return (
		settings.host === values.host.trim() &&
		settings.port === Number(values.port) &&
		settings.security === values.security &&
		(settings.username ?? "") === values.username.trim() &&
		settings.allowInvalidCertificate === values.allowInvalidCertificate
	);
}

function EmailForm({ settings, onSaved }: { settings: EmailSettingsDto | null; onSaved: (settings: EmailSettingsDto) => void }) {
	const t = useTranslations("emailSettings");
	const dates = useDateFormat();
	const errorMessage = useErrorMessage();
	const { errors, validate, applyApiError, setErrors, setFieldError } = useFormErrors();
	const [values, setValues] = useState<FormValues>(() => toFormValues(settings));
	const [pending, setPending] = useState<"save" | "verify" | "send" | null>(null);
	const [formError, setFormError] = useState<string | null>(null);
	const [testResult, setTestResult] = useState<string | null>(null);

	const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
		setFormError(null);
		setTestResult(null);
		setValues((current) => ({ ...current, [key]: value }));
	};

	const passwordKept = settings?.hasPassword === true && isSameServer(settings, values);

	/**
	 * The request body. A password that was left empty is omitted, so the stored one is kept; only
	 * clearing the user name removes it.
	 */
	function toRequest(): EmailSettingsRequest | null {
		const input = validate(emailSettingsSchema, {
			enabled: values.enabled,
			host: values.host,
			port: values.port.trim() === "" ? Number.NaN : Number(values.port),
			security: values.security,
			username: values.username,
			...(values.password === "" ? {} : { password: values.password }),
			fromName: values.fromName,
			fromAddress: values.fromAddress,
			replyTo: values.replyTo,
			allowInvalidCertificate: values.allowInvalidCertificate,
		});
		if (input?.username && input.password === undefined && !passwordKept) {
			setFieldError("password", "required");
			return null;
		}
		return input;
	}

	/** Turns a rejected request into either field errors or the banner above the form. */
	function reportFailure(error: unknown) {
		if (applyApiError(error)) {
			return;
		}
		setFormError(errorMessage(error));
		if (error instanceof ApiRequestError && error.code === "smtp_connection_failed") {
			// The server's own reply says far more than a generic message ever could.
			toast.error(error.message);
		}
	}

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);
		setTestResult(null);
		const input = toRequest();
		if (!input) {
			return;
		}

		setPending("save");
		try {
			const saved = await api.put<EmailSettingsDto>("/settings/email", input);
			onSaved(saved);
			setValues(toFormValues(saved));
			setErrors({});
			toast.success(t("saved"));
		} catch (error) {
			reportFailure(error);
		} finally {
			setPending(null);
		}
	}

	async function runTest(mode: "verify" | "send") {
		setFormError(null);
		setTestResult(null);
		const input = toRequest();
		if (!input) {
			return;
		}

		setPending(mode);
		try {
			const result = await api.post<EmailTestResponse>("/settings/email/test", { ...input, mode });
			const message = result.deliveredTo
				? t("testDelivered", { email: result.deliveredTo })
				: t("testSucceeded", { ms: result.durationMs });
			setTestResult(message);
			toast.success(message);
		} catch (error) {
			reportFailure(error);
		} finally {
			setPending(null);
		}
	}

	const busy = pending !== null;
	const savedValues = toFormValues(settings);
	const dirty = settings !== null && (Object.keys(values) as (keyof FormValues)[]).some((key) => values[key] !== savedValues[key]);

	function discard() {
		setValues(savedValues);
		setErrors({});
		setFormError(null);
		setTestResult(null);
	}

	return (
		<form
			onSubmit={onSubmit}
			noValidate
			aria-busy={busy || settings === null}
			inert={settings === null}
			className="flex flex-col gap-6"
		>
			<EmailOverview
				enabled={values.enabled}
				onEnabledChange={(checked) => set("enabled", checked)}
				status={
					settings === null
						? null
						: settings.lastVerifiedAt
							? t("lastVerified", { date: dates.dateTime(settings.lastVerifiedAt) })
							: t("neverVerified")
				}
				busy={busy}
				pending={pending}
				onTest={(mode) => void runTest(mode)}
				formError={formError}
				testResult={testResult}
			/>
			<fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
				<Section title={t("server")} description={t("serverDescription")}>
					<FieldGroup>
						<div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_8rem]">
							<FormField id="email-host" label={t("host")} error={errors.host}>
								<Input
									id="email-host"
									value={values.host}
									placeholder={t("hostPlaceholder")}
									autoComplete="off"
									spellCheck={false}
									onChange={(event) => set("host", event.target.value)}
									aria-invalid={errors.host ? true : undefined}
								/>
							</FormField>
							<FormField id="email-port" label={t("port")} error={errors.port}>
								<Input
									id="email-port"
									type="number"
									inputMode="numeric"
									min={1}
									max={65535}
									value={values.port}
									onChange={(event) => set("port", event.target.value)}
									aria-invalid={errors.port ? true : undefined}
								/>
							</FormField>
						</div>

						<FormField
							id="email-security"
							label={t("security")}
							description={t(`securityHints.${values.security}`)}
							error={errors.security}
						>
							<Select
								value={values.security}
								disabled={busy}
								onValueChange={(value) => {
									setFormError(null);
									setTestResult(null);
									const security = value as SmtpSecurity;
									// The port almost always follows the mode; only a custom one is kept.
									const wasDefault = Object.values(SMTP_DEFAULT_PORTS).includes(Number(values.port));
									setValues((current) => ({
										...current,
										security,
										port: wasDefault ? String(SMTP_DEFAULT_PORTS[security]) : current.port,
									}));
								}}
							>
								<SelectTrigger id="email-security" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{SMTP_SECURITY_MODES.map((mode) => (
										<SelectItem key={mode} value={mode}>
											{t(`securityModes.${mode}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FormField>

						<Field orientation="horizontal" className="rounded-lg border bg-muted/20 p-4">
							<FieldContent>
								<FieldLabel htmlFor="email-allow-invalid-certificate">{t("allowInvalidCertificate")}</FieldLabel>
								<FieldDescription>{t("allowInvalidCertificateDescription")}</FieldDescription>
							</FieldContent>
							<Switch
								id="email-allow-invalid-certificate"
								checked={values.allowInvalidCertificate}
								onCheckedChange={(checked) => set("allowInvalidCertificate", checked)}
								disabled={busy}
							/>
						</Field>

						<FieldSeparator />
						<div className="space-y-1">
							<h3 className="text-sm font-medium">{t("credentials")}</h3>
							<p className="text-sm text-muted-foreground">{t("credentialsDescription")}</p>
						</div>
						<div className="grid gap-6 sm:grid-cols-2">
							<FormField id="email-username" label={t("username")} error={errors.username}>
								<Input
									id="email-username"
									value={values.username}
									autoComplete="off"
									spellCheck={false}
									onChange={(event) => set("username", event.target.value)}
									aria-invalid={errors.username ? true : undefined}
								/>
							</FormField>
							<FormField
								id="email-password"
								label={t("password")}
								description={
									settings?.hasPassword ? (passwordKept ? t("passwordKept") : t("passwordRequired")) : t("passwordStored")
								}
								error={errors.password}
							>
								<PasswordInput
									id="email-password"
									value={values.password}
									autoComplete="new-password"
									placeholder={passwordKept ? "••••••••" : undefined}
									onChange={(event) => set("password", event.target.value)}
									aria-invalid={errors.password ? true : undefined}
								/>
							</FormField>
						</div>
					</FieldGroup>
				</Section>
				<Section title={t("sender")} description={t("senderDescription")}>
					<FieldGroup>
						<FormField id="email-from-name" label={t("fromName")} error={errors.fromName}>
							<Input
								id="email-from-name"
								value={values.fromName}
								onChange={(event) => set("fromName", event.target.value)}
								aria-invalid={errors.fromName ? true : undefined}
							/>
						</FormField>
						<div className="grid gap-6 sm:grid-cols-2">
							<FormField
								id="email-from-address"
								label={t("fromAddress")}
								description={t("fromAddressDescription")}
								error={errors.fromAddress}
							>
								<Input
									id="email-from-address"
									type="email"
									value={values.fromAddress}
									autoComplete="off"
									spellCheck={false}
									onChange={(event) => set("fromAddress", event.target.value)}
									aria-invalid={errors.fromAddress ? true : undefined}
								/>
							</FormField>

							<FormField
								id="email-reply-to"
								label={
									<>
										{t("replyTo")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
									</>
								}
								description={t("replyToDescription")}
								error={errors.replyTo}
							>
								<Input
									id="email-reply-to"
									type="email"
									value={values.replyTo}
									autoComplete="off"
									spellCheck={false}
									onChange={(event) => set("replyTo", event.target.value)}
									aria-invalid={errors.replyTo ? true : undefined}
								/>
							</FormField>
						</div>
					</FieldGroup>
				</Section>
			</fieldset>
			{dirty ? (
				<UnsavedChangesBar
					saving={pending === "save"}
					disabled={busy}
					hint={values.enabled ? t("saveHint") : undefined}
					onDiscard={discard}
				/>
			) : null}
		</form>
	);
}

/** Controls whether Aegis sends account emails. */
function EmailOverview({
	enabled,
	onEnabledChange,
	status,
	busy,
	pending,
	onTest,
	formError,
	testResult,
}: {
	enabled: boolean;
	onEnabledChange: (enabled: boolean) => void;
	status: ReactNode;
	busy: boolean;
	pending: "save" | "verify" | "send" | null;
	onTest: (mode: "verify" | "send") => void;
	formError: string | null;
	testResult: string | null;
}) {
	const t = useTranslations("emailSettings");

	return (
		<Section
			title={t("configuration")}
			description={t("configurationDescription")}
			className="[--card-spacing:--spacing(5)] sm:[--card-spacing:--spacing(6)]"
			contentClassName="py-0"
		>
			<div className="divide-y">
				<div className="flex items-center gap-4 py-5">
					<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 ring-inset">
						<Send aria-hidden="true" className="size-4.5" />
					</span>
					<Field orientation="horizontal" className="min-w-0 gap-5">
						<FieldContent className="min-w-0 gap-1">
							<FieldLabel htmlFor="email-enabled">{t("enabled")}</FieldLabel>
							<FieldDescription id="email-enabled-description">{t("enabledDescription")}</FieldDescription>
							<p className="min-h-4 text-xs text-muted-foreground">{status}</p>
						</FieldContent>
						<Switch
							id="email-enabled"
							aria-describedby="email-enabled-description"
							checked={enabled}
							onCheckedChange={onEnabledChange}
							disabled={busy}
							className="shrink-0 self-center"
						/>
					</Field>
				</div>
				<div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
					<div className="flex min-w-0 items-center gap-4">
						<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-border ring-inset">
							<MailCheck aria-hidden="true" className="size-4.5" />
						</span>
						<div className="min-w-0 space-y-1">
							<h3 className="text-sm font-medium">{t("test")}</h3>
							<p className="text-sm leading-normal text-muted-foreground">{t("testMenuHint")}</p>
						</div>
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button type="button" variant="outline" size="lg" disabled={busy} className="w-full sm:w-auto">
								{pending === "verify" || pending === "send" ? <Spinner /> : <MailCheck />}
								{t("testActions")}
								<ChevronDown />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
							<DropdownMenuItem disabled={busy} onSelect={() => onTest("verify")} className="items-start py-2">
								<MailCheck className="mt-0.5" />
								<span className="space-y-1">
									<span className="block font-medium">{t("test")}</span>
									<span className="block text-xs text-muted-foreground">{t("testDescription")}</span>
								</span>
							</DropdownMenuItem>
							<DropdownMenuItem disabled={busy} onSelect={() => onTest("send")} className="items-start py-2">
								<Send className="mt-0.5" />
								<span className="space-y-1">
									<span className="block font-medium">{t("sendTest")}</span>
									<span className="block text-xs text-muted-foreground">{t("sendTestDescription")}</span>
								</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				{formError || testResult ? (
					<div className="space-y-3 py-5" aria-live="polite">
						{formError ? <StatusMessage tone="error" title={formError} /> : null}
						{testResult ? <StatusMessage tone="success" title={testResult} /> : null}
					</div>
				) : null}
			</div>
		</Section>
	);
}
