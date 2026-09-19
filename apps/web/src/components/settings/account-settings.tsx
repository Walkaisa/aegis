"use client";

import { type AccountResponse, normalizeEmail, passwordChangeSchema, profileUpdateSchema, SUPPORTED_LOCALES } from "@aegis/contracts";
import { CalendarDays, Check, KeyRound, LogIn, type LucideIcon, Monitor, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import { ActionsMenu, CopyMenuItem } from "@/components/actions-menu";
import { EditableAvatar } from "@/components/avatar-editor";
import { useAccount } from "@/components/dashboard/account-context";
import { Section } from "@/components/dashboard/page";
import { FlagIcon, LOCALE_OPTIONS } from "@/components/flag-icon";
import { FormField } from "@/components/form-field";
import { type LocalePreference, useLocalePreference } from "@/components/locale-preference";
import { PasswordInput } from "@/components/password-input";
import { PasswordStrength } from "@/components/password-strength";
import { SearchSelect, type SearchSelectOption } from "@/components/search-select";
import { TwoFactorSection } from "@/components/two-factor/two-factor-section";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { RoleBadge } from "@/components/users/account-badges";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormErrors } from "@/hooks/use-form-errors";
import { ApiRequestError, api } from "@/lib/api";
import { useDateFormat } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Profile, password, two-factor authentication and appearance of the signed-in admin. */
export function AccountSettings() {
	return (
		<>
			<AccountHero />
			<ProfileSection />
			<PasswordSection />
			<TwoFactorSection />
			<AppearanceSection />
		</>
	);
}

function AccountHero() {
	const t = useTranslations("settings");
	const dates = useDateFormat();
	const { me, update } = useAccount();
	const { account } = me;

	const facts: { icon: LucideIcon; label: string; value: string }[] = [
		{ icon: CalendarDays, label: t("accountCreated"), value: dates.date(account.createdAt) },
		{ icon: LogIn, label: t("lastSignIn"), value: account.lastSignInAt ? dates.relative(account.lastSignInAt) : t("never") },
		{ icon: KeyRound, label: t("passwordChangedAt"), value: dates.relative(account.passwordChangedAt) },
	];

	return (
		<section className="relative overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
			{/* The accent fades out through a mask, so it melts into the card instead of ending in an edge. */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-br from-primary/30 via-primary/12 to-transparent mask-[linear-gradient(to_bottom,black_0%,black_25%,transparent_85%)]"
			/>
			<ActionsMenu className="absolute top-3 right-3 z-10">
				<CopyMenuItem value={account.id} label={t("copyUserId")} copiedMessage={t("userIdCopied")} />
			</ActionsMenu>
			<div className="relative flex flex-col gap-5 p-5 pt-8 sm:flex-row sm:items-end sm:justify-between">
				<div className="flex min-w-0 items-center gap-4">
					<EditableAvatar
						name={account.displayName}
						src={account.avatarUrl}
						onUpload={async (image) => {
							const result = await api.upload<AccountResponse>("/account/avatar", image);
							update({ ...me, account: result.account });
						}}
						onRemove={async () => {
							const result = await api.delete<AccountResponse>("/account/avatar");
							update({ ...me, account: result.account });
						}}
					/>
					<div className="flex min-w-0 flex-col gap-1">
						<div className="flex flex-wrap items-center gap-2">
							<h2 className="truncate text-lg font-semibold tracking-tight">{account.displayName}</h2>
							<RoleBadge role={account.role} />
						</div>
						<p className="truncate text-sm text-muted-foreground">{account.email}</p>
					</div>
				</div>
			</div>
			<dl className="relative grid border-t sm:grid-cols-3">
				{facts.map((fact, index) => (
					<div
						key={fact.label}
						className={cn("flex items-center gap-3 px-5 py-3.5", index > 0 && "border-t sm:border-t-0 sm:border-l")}
					>
						<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
							<fact.icon className="size-4" />
						</span>
						<div className="flex min-w-0 flex-col">
							<dt className="text-xs text-muted-foreground">{fact.label}</dt>
							<dd className="truncate text-sm font-medium">{fact.value}</dd>
						</div>
					</div>
				))}
			</dl>
		</section>
	);
}

function ProfileSection() {
	const t = useTranslations("settings");
	const errorMessage = useErrorMessage();
	const { me, update } = useAccount();
	const { errors, validate, applyApiError, setFieldError } = useFormErrors();
	const [values, setValues] = useState({ displayName: me.account.displayName, email: me.account.email, currentPassword: "" });
	const [submitting, setSubmitting] = useState(false);
	const emailChanged = normalizeEmail(values.email) !== normalizeEmail(me.account.email);
	const dirty = values.displayName !== me.account.displayName || emailChanged;

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const input = validate(profileUpdateSchema, { ...values, currentPassword: emailChanged ? values.currentPassword : undefined });
		if (!input) {
			return;
		}
		if (emailChanged && !values.currentPassword) {
			setFieldError("currentPassword", "required");
			return;
		}

		setSubmitting(true);
		try {
			const result = await api.put<AccountResponse>("/account", input);
			update({ ...me, account: result.account });
			setValues({ displayName: result.account.displayName, email: result.account.email, currentPassword: "" });
			toast.success(t("profileSaved"));
		} catch (error) {
			if (applyApiError(error)) {
				return;
			}
			if (error instanceof ApiRequestError && error.code === "invalid_current_password") {
				setFieldError("currentPassword", "current_password_invalid");
				return;
			}
			if (error instanceof ApiRequestError && error.code === "email_taken") {
				setFieldError("email", "email_taken");
				return;
			}
			toast.error(errorMessage(error));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<form onSubmit={onSubmit} noValidate>
			<Section
				title={t("profile")}
				description={t("profileDescription")}
				footer={
					<Button type="submit" disabled={!dirty || submitting}>
						{submitting ? <Spinner /> : null}
						{t("save")}
					</Button>
				}
			>
				<FieldGroup>
					<div className="grid gap-6 sm:grid-cols-2">
						<FormField id="profile-name" label={t("displayName")} error={errors.displayName}>
							<Input
								id="profile-name"
								autoComplete="name"
								value={values.displayName}
								onChange={(event) => setValues((current) => ({ ...current, displayName: event.target.value }))}
								aria-invalid={errors.displayName ? true : undefined}
							/>
						</FormField>
						<FormField id="profile-email" label={t("email")} description={t("emailDescription")} error={errors.email}>
							<Input
								id="profile-email"
								type="email"
								autoComplete="email"
								value={values.email}
								onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
								aria-invalid={errors.email ? true : undefined}
							/>
						</FormField>
					</div>
					{emailChanged ? (
						<div className="animate-in fade-in-0 slide-in-from-top-1 duration-200 sm:max-w-[calc(50%-0.75rem)]">
							<FormField
								id="profile-password"
								label={t("currentPassword")}
								description={t("currentPasswordDescription")}
								error={errors.currentPassword}
							>
								<PasswordInput
									id="profile-password"
									autoComplete="current-password"
									value={values.currentPassword}
									onChange={(event) => setValues((current) => ({ ...current, currentPassword: event.target.value }))}
									aria-invalid={errors.currentPassword ? true : undefined}
								/>
							</FormField>
						</div>
					) : null}
				</FieldGroup>
			</Section>
		</form>
	);
}

const EMPTY_PASSWORDS = { currentPassword: "", newPassword: "", confirmation: "" };

function PasswordSection() {
	const t = useTranslations("settings");
	const errorMessage = useErrorMessage();
	const { errors, validate, applyApiError, setFieldError } = useFormErrors();
	const [values, setValues] = useState(EMPTY_PASSWORDS);
	const [submitting, setSubmitting] = useState(false);
	const dirty = Object.values(values).some((value) => value.length > 0);

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const input = validate(passwordChangeSchema, values);
		const mismatch = values.newPassword !== values.confirmation;
		if (mismatch) {
			setFieldError("confirmation", "password_mismatch");
		}
		if (!input || mismatch) {
			return;
		}

		setSubmitting(true);
		try {
			await api.post("/account/password", input);
			setValues(EMPTY_PASSWORDS);
			toast.success(t("passwordChanged"));
		} catch (error) {
			if (applyApiError(error)) {
				return;
			}
			if (error instanceof ApiRequestError && error.code === "invalid_current_password") {
				setFieldError("currentPassword", "current_password_invalid");
				return;
			}
			toast.error(errorMessage(error));
		} finally {
			setSubmitting(false);
		}
	}

	const bind = (field: keyof typeof EMPTY_PASSWORDS) => ({
		id: `password-${field}`,
		value: values[field],
		onChange: (event: { target: { value: string } }) => setValues((current) => ({ ...current, [field]: event.target.value })),
		"aria-invalid": errors[field] ? true : undefined,
	});

	return (
		<form onSubmit={onSubmit} noValidate>
			<Section
				title={t("password")}
				description={t("passwordDescription")}
				footer={
					<Button type="submit" disabled={!dirty || submitting}>
						{submitting ? <Spinner /> : null}
						{t("changePassword")}
					</Button>
				}
			>
				<FieldGroup>
					<div className="sm:max-w-[calc(50%-0.75rem)]">
						<FormField id="password-currentPassword" label={t("currentPassword")} error={errors.currentPassword}>
							<PasswordInput {...bind("currentPassword")} autoComplete="current-password" />
						</FormField>
					</div>
					<FieldSeparator />
					<div className="grid items-start gap-6 sm:grid-cols-2">
						<FormField id="password-newPassword" label={t("newPassword")} error={errors.newPassword}>
							<PasswordInput {...bind("newPassword")} autoComplete="new-password" />
						</FormField>
						<FormField id="password-confirmation" label={t("confirmPassword")} error={errors.confirmation}>
							<PasswordInput {...bind("confirmation")} autoComplete="new-password" />
						</FormField>
					</div>
					<PasswordStrength password={values.newPassword} />
				</FieldGroup>
			</Section>
		</form>
	);
}

const THEMES: { value: "system" | "light" | "dark"; icon: LucideIcon }[] = [
	{ value: "system", icon: Monitor },
	{ value: "light", icon: Sun },
	{ value: "dark", icon: Moon },
];

function AppearanceSection() {
	const t = useTranslations("settings");
	const tPreferences = useTranslations("preferences");
	const locale = useLocale();
	const { preference, setPreference, pending } = useLocalePreference();
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => setMounted(true), []);

	const languageOptions: SearchSelectOption[] = [
		{
			value: "system",
			label: tPreferences("system"),
			// While following the browser, show which language that currently resolves to.
			hint: preference === "system" ? `(${LOCALE_OPTIONS[locale as keyof typeof LOCALE_OPTIONS]?.label ?? locale})` : undefined,
			keywords: ["auto", "browser"],
			icon: <Monitor className="size-4 text-muted-foreground" />,
		},
		...SUPPORTED_LOCALES.map((code) => ({
			value: code,
			label: LOCALE_OPTIONS[code].label,
			keywords: [code],
			lang: code,
			icon: <FlagIcon country={LOCALE_OPTIONS[code].flag} />,
		})),
	];

	const activeTheme = mounted ? (theme ?? "system") : "system";

	return (
		<Section title={t("appearance")} description={t("appearanceDescription")}>
			<FieldGroup>
				<Field orientation="responsive">
					<FieldContent>
						<FieldLabel htmlFor="appearance-language">{t("language")}</FieldLabel>
						<FieldDescription>{t("languageDescription")}</FieldDescription>
					</FieldContent>
					<SearchSelect
						id="appearance-language"
						className="sm:w-64"
						value={preference}
						onChange={(value) => setPreference(value as LocalePreference)}
						options={languageOptions}
						placeholder={t("language")}
						searchPlaceholder={t("languageSearch")}
						emptyMessage={t("languageEmpty")}
						disabled={pending}
					/>
				</Field>

				<FieldSeparator />

				<Field>
					<FieldContent>
						<FieldLabel id="appearance-theme">{t("theme")}</FieldLabel>
						<FieldDescription>{t("themeDescription")}</FieldDescription>
					</FieldContent>
					<RadioGroup
						aria-labelledby="appearance-theme"
						value={activeTheme}
						onValueChange={setTheme}
						className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3"
					>
						{THEMES.map((option) => (
							<ThemeCard key={option.value} value={option.value} icon={option.icon} checked={activeTheme === option.value}>
								{tPreferences(option.value)}
							</ThemeCard>
						))}
					</RadioGroup>
				</Field>
			</FieldGroup>
		</Section>
	);
}

function ThemeCard({
	value,
	icon: Icon,
	checked,
	children,
}: {
	value: "system" | "light" | "dark";
	icon: LucideIcon;
	checked: boolean;
	children: ReactNode;
}) {
	const id = `theme-${value}`;

	return (
		<label
			htmlFor={id}
			className={cn(
				"group/theme relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card transition-all duration-200 hover:border-foreground/20",
				checked && "border-primary ring-3 ring-primary/15 hover:border-primary",
			)}
		>
			<RadioGroupItem value={value} id={id} className="sr-only" />
			<div className="relative h-24 overflow-hidden border-b bg-muted/40 p-3">
				{value === "system" ? (
					<div className="absolute inset-3 flex overflow-hidden rounded-md ring-1 ring-black/10">
						<ThemePreview mode="light" className="w-1/2 rounded-none ring-0" />
						<ThemePreview mode="dark" className="w-1/2 rounded-none ring-0" />
					</div>
				) : (
					<ThemePreview mode={value} className="absolute inset-3" />
				)}
			</div>
			<div className="flex items-center justify-between gap-2 px-3 py-2.5">
				<span className="flex items-center gap-2 text-sm font-medium">
					<Icon className="size-4 text-muted-foreground" />
					{children}
				</span>
				<span
					className={cn(
						"flex size-4.5 items-center justify-center rounded-full border transition-all duration-200",
						checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
					)}
				>
					<Check className={cn("size-3 transition-transform duration-200", checked ? "scale-100" : "scale-0")} strokeWidth={3} />
				</span>
			</div>
		</label>
	);
}

/** A tiny window mock-up in the given colour scheme; the colours are fixed on purpose. */
function ThemePreview({ mode, className }: { mode: "light" | "dark"; className?: string }) {
	const dark = mode === "dark";

	return (
		<div
			aria-hidden="true"
			className={cn("flex overflow-hidden rounded-md ring-1 ring-black/10", dark ? "bg-[#17181f]" : "bg-white", className)}
		>
			<div className={cn("flex w-1/4 flex-col gap-1 p-1.5", dark ? "bg-[#101117]" : "bg-[#f3f4f8]")}>
				<span className="h-1.5 w-full rounded-full bg-[#6366f1]" />
				<span className={cn("h-1 w-3/4 rounded-full", dark ? "bg-white/15" : "bg-black/10")} />
				<span className={cn("h-1 w-2/3 rounded-full", dark ? "bg-white/15" : "bg-black/10")} />
			</div>
			<div className="flex flex-1 flex-col gap-1.5 p-2">
				<span className={cn("h-1.5 w-1/2 rounded-full", dark ? "bg-white/40" : "bg-black/35")} />
				<span className={cn("h-1 w-5/6 rounded-full", dark ? "bg-white/15" : "bg-black/10")} />
				<div className="mt-auto flex gap-1">
					<span className={cn("h-3 flex-1 rounded-sm", dark ? "bg-white/8" : "bg-black/5")} />
					<span className={cn("h-3 flex-1 rounded-sm", dark ? "bg-white/8" : "bg-black/5")} />
				</div>
			</div>
		</div>
	);
}
