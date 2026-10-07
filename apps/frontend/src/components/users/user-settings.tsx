"use client";

import {
	PASSWORD_MIN_LENGTH,
	type PasswordResetResponse,
	passwordResetSchema,
	ROLES,
	type Role,
	type UserDto,
	type UserResponse,
	userUpdateSchema,
} from "@aegis/contracts";
import { KeyRound, Lock, Power, ShieldCheck, ShieldOff, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { CopyField } from "@/components/copy-button";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { ActionRow, DangerZone, Section } from "@/components/dashboard/page";
import { FormField } from "@/components/form-field";
import { PasswordInput } from "@/components/password-input";
import { PasswordStrength } from "@/components/password-strength";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { AccountStatus } from "@/components/users/account-badges";
import { OPTION_CARD } from "@/components/users/new-user-page";
import { useUser } from "@/components/users/user-layout";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormErrors } from "@/hooks/use-form-errors";
import { ApiRequestError, api } from "@/lib/api";
import { useDateFormat } from "@/lib/format";
import { cn } from "@/lib/utils";

const ROLE_ICONS = { user: UserRound, admin: ShieldCheck } as const;

/** Editable fields of an account as expected by `PUT /api/users/:id`. */
function editable(user: UserDto) {
	return { displayName: user.displayName, email: user.email, role: user.role, emailVerified: user.emailVerified };
}

/** The settings tab of an account: profile, role, status, password, two-factor authentication and deletion. */
export function UserSettings() {
	const { user } = useUser();

	return (
		<div className="flex max-w-3xl flex-col gap-6">
			<ProfileSection key={`profile-${user.updatedAt}`} />
			<RoleSection key={`role-${user.updatedAt}`} />
			<StatusSection />
			<PasswordSection />
			<TwoFactorSection />
			<DeleteSection />
		</div>
	);
}

function ProfileSection() {
	const t = useTranslations("userDetail");
	const { user, path, setUser } = useUser();
	const errorMessage = useErrorMessage();
	const { errors, validate, applyApiError, setFieldError } = useFormErrors();
	const [values, setValues] = useState(() => editable(user));
	const [submitting, setSubmitting] = useState(false);

	const dirty = values.displayName !== user.displayName || values.email !== user.email || values.emailVerified !== user.emailVerified;
	const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
		setValues((current) => ({ ...current, [key]: value }));

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const input = validate(userUpdateSchema, { ...values, role: user.role });
		if (!input) {
			return;
		}

		setSubmitting(true);
		try {
			const result = await api.put<UserResponse>(path, input);
			toast.success(t("saved"));
			setUser(result.user);
		} catch (error) {
			if (applyApiError(error)) {
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
						<FormField id="profile-display-name" label={t("displayName")} error={errors.displayName}>
							<Input
								id="profile-display-name"
								value={values.displayName}
								onChange={(event) => set("displayName", event.target.value)}
								aria-invalid={errors.displayName ? true : undefined}
							/>
						</FormField>
						<FormField id="profile-email" label={t("email")} error={errors.email}>
							<Input
								id="profile-email"
								type="email"
								inputMode="email"
								autoComplete="email"
								autoCapitalize="none"
								autoCorrect="off"
								spellCheck={false}
								value={values.email}
								onChange={(event) => set("email", event.target.value)}
								aria-invalid={errors.email ? true : undefined}
							/>
						</FormField>
					</div>
					<Field orientation="horizontal">
						<FieldContent>
							<FieldLabel htmlFor="profile-email-verified">{t("emailVerified")}</FieldLabel>
							<FieldDescription>{t("emailVerifiedDescription")}</FieldDescription>
						</FieldContent>
						<Switch
							id="profile-email-verified"
							checked={values.emailVerified}
							onCheckedChange={(checked) => set("emailVerified", checked)}
						/>
					</Field>
				</FieldGroup>
			</Section>
		</form>
	);
}

function RoleSection() {
	const t = useTranslations("userDetail");
	const tRoles = useTranslations("roles");
	const tNew = useTranslations("newUser");
	const { user, path, self, setUser, signOutSelf } = useUser();
	const errorMessage = useErrorMessage();
	const [role, setRole] = useState<Role>(user.role);
	const [submitting, setSubmitting] = useState(false);
	const locked = user.isLastActiveAdmin;
	const changed = role !== user.role;

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitting(true);
		try {
			const result = await api.put<UserResponse>(path, { ...editable(user), role });
			toast.success(t("saved"));
			if (self) {
				signOutSelf();
				return;
			}
			setUser(result.user);
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<form onSubmit={onSubmit} noValidate>
			<Section
				title={t("role")}
				description={t("roleDescription")}
				footer={
					<Button type="submit" disabled={!changed || locked || submitting}>
						{submitting ? <Spinner /> : null}
						{t("changeRole")}
					</Button>
				}
			>
				<div className="flex flex-col gap-4">
					<RadioGroup
						value={role}
						onValueChange={(value) => setRole(value as Role)}
						disabled={locked}
						className="grid gap-3 sm:grid-cols-2"
						aria-label={t("role")}
					>
						{ROLES.map((option) => {
							const Icon = ROLE_ICONS[option];
							return (
								<label
									key={option}
									htmlFor={`role-${option}`}
									className={cn(
										OPTION_CARD,
										"flex flex-col gap-3 p-4",
										locked && "cursor-not-allowed opacity-60 hover:bg-card",
									)}
								>
									<span className="flex items-start justify-between gap-2">
										<span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
											<Icon className="size-5" />
										</span>
										<RadioGroupItem value={option} id={`role-${option}`} />
									</span>
									<span className="flex flex-col gap-1">
										<span className="font-medium">{tRoles(option)}</span>
										<span className="text-sm text-muted-foreground">{tNew(`roles.${option}`)}</span>
									</span>
								</label>
							);
						})}
					</RadioGroup>

					{locked ? (
						<StatusMessage tone="info" icon={<Lock />} title={t("lastAdmin.title")}>
							{t("lastAdmin.role")}
						</StatusMessage>
					) : changed ? (
						<StatusMessage tone="warning" title={t("roleChangeTitle")}>
							{self ? t("roleChangeSelfWarning") : t("roleChangeWarning")}
						</StatusMessage>
					) : null}
				</div>
			</Section>
		</form>
	);
}

function StatusSection() {
	const t = useTranslations("userDetail");
	const { user, path, self, setUser, signOutSelf } = useUser();
	const locked = user.enabled && user.isLastActiveAdmin;

	async function setEnabled(enabled: boolean) {
		const result = await api.post<UserResponse>(`${path}/${enabled ? "enable" : "disable"}`);
		toast.success(enabled ? t("enabledToast") : t("disabledToast"));
		if (self && !enabled) {
			signOutSelf();
			return;
		}
		setUser(result.user);
	}

	return (
		<Section title={t("status")} description={t("statusDescription")}>
			<div className="flex flex-col gap-4">
				<ActionRow
					action={
						user.enabled ? (
							<ConfirmDialog
								trigger={
									<Button variant="outline" disabled={locked}>
										<Power />
										{t("disable")}
									</Button>
								}
								title={t("disableTitle")}
								description={t("disableDescription", { name: user.displayName })}
								confirmLabel={t("disableConfirm")}
								destructive
								onConfirm={() => setEnabled(false)}
							/>
						) : (
							<ConfirmDialog
								trigger={
									<Button>
										<Power />
										{t("enable")}
									</Button>
								}
								title={t("enableTitle")}
								description={t("enableDescription", { name: user.displayName })}
								confirmLabel={t("enable")}
								onConfirm={() => setEnabled(true)}
							/>
						)
					}
				>
					<div className="flex flex-col gap-1">
						<span className="text-foreground">
							<AccountStatus enabled={user.enabled} />
						</span>
						<span>{user.enabled ? t("statusEnabledDescription") : t("statusDisabledDescription")}</span>
					</div>
				</ActionRow>
				{locked ? (
					<StatusMessage tone="info" icon={<Lock />} title={t("lastAdmin.title")}>
						{t("lastAdmin.disable")}
					</StatusMessage>
				) : null}
			</div>
		</Section>
	);
}

function PasswordSection() {
	const t = useTranslations("userDetail");
	const tCommon = useTranslations("common");
	const { user, path, self, setUser, signOutSelf } = useUser();
	const dates = useDateFormat();
	const errorMessage = useErrorMessage();
	const { errors, validate, applyApiError, clear } = useFormErrors();
	const [open, setOpen] = useState(false);
	const [mode, setMode] = useState<"generate" | "manual">("generate");
	const [password, setPassword] = useState("");
	const [result, setResult] = useState<PasswordResetResponse | null>(null);
	const [submitting, setSubmitting] = useState(false);

	function reset() {
		setOpen(false);
		setMode("generate");
		setPassword("");
		setResult(null);
		clear();
	}

	function finish(updated: UserDto) {
		reset();
		if (self) {
			signOutSelf();
			return;
		}
		setUser(updated);
	}

	async function submit() {
		const input = validate(passwordResetSchema, mode === "generate" ? { mode } : { mode, password });
		if (!input) {
			return;
		}

		setSubmitting(true);
		try {
			const response = await api.post<PasswordResetResponse>(`${path}/password`, input);
			toast.success(t("resetDone"));
			if (response.generatedPassword) {
				setResult(response);
			} else {
				finish(response.user);
			}
		} catch (error) {
			if (!applyApiError(error)) {
				toast.error(errorMessage(error));
			}
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Section title={t("password")} description={t("passwordDescription", { time: dates.relative(user.passwordChangedAt) })}>
			<ActionRow
				action={
					<Button variant="outline" onClick={() => setOpen(true)}>
						<KeyRound />
						{t("resetPassword")}
					</Button>
				}
			>
				{t("resetHint")}
			</ActionRow>

			<Dialog
				open={open}
				onOpenChange={(next) => {
					if (!next && !result && !submitting) {
						reset();
					}
				}}
			>
				<DialogContent showCloseButton={!result} onPointerDownOutside={(event) => result && event.preventDefault()}>
					<DialogHeader>
						<DialogTitle>{result ? t("generatedTitle") : t("resetTitle")}</DialogTitle>
						<DialogDescription>
							{result ? t("generatedDescription") : t("resetDescription", { name: user.displayName })}
						</DialogDescription>
					</DialogHeader>

					{result?.generatedPassword ? (
						<StatusMessage tone="warning" title={t("generatedWarningTitle")}>
							<div className="flex flex-col gap-2">
								<span>{t("generatedWarning")}</span>
								<CopyField value={result.generatedPassword} />
							</div>
						</StatusMessage>
					) : (
						<FieldGroup>
							<RadioGroup value={mode} onValueChange={(value) => setMode(value as "generate" | "manual")} className="gap-2">
								{(["generate", "manual"] as const).map((option) => (
									<label
										key={option}
										htmlFor={`reset-${option}`}
										className={cn(OPTION_CARD, "flex items-start gap-3 p-3")}
									>
										<RadioGroupItem value={option} id={`reset-${option}`} className="mt-0.5" />
										<span className="flex flex-col gap-0.5 text-sm">
											<span className="font-medium">{t(`resetModes.${option}.title`)}</span>
											<span className="text-muted-foreground">
												{t(`resetModes.${option}.description`, { min: PASSWORD_MIN_LENGTH })}
											</span>
										</span>
									</label>
								))}
							</RadioGroup>
							{mode === "manual" ? (
								<FormField id="reset-password" label={t("newPassword")} error={errors.password}>
									<PasswordInput
										id="reset-password"
										autoComplete="new-password"
										value={password}
										onChange={(event) => setPassword(event.target.value)}
										aria-invalid={errors.password ? true : undefined}
									/>
									<PasswordStrength password={password} />
								</FormField>
							) : null}
						</FieldGroup>
					)}

					<DialogFooter>
						{result ? (
							<Button onClick={() => finish(result.user)}>{tCommon("done")}</Button>
						) : (
							<>
								<Button variant="outline" disabled={submitting} onClick={reset}>
									{tCommon("cancel")}
								</Button>
								<Button disabled={submitting} onClick={() => void submit()}>
									{submitting ? <Spinner /> : null}
									{t("resetSubmit")}
								</Button>
							</>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Section>
	);
}

/**
 * Two-factor authentication can only be set up by the account itself. Admins can turn it off for
 * others, e.g. after a lost device; their own lives in the account settings.
 */
function TwoFactorSection() {
	const t = useTranslations("userDetail.twoFactor");
	const { user, path, self, setUser } = useUser();

	async function reset() {
		const result = await api.delete<UserResponse>(`${path}/two-factor`);
		toast.success(t("resetDone", { name: user.displayName }));
		setUser(result.user);
	}

	return (
		<Section title={t("title")} description={t("description")}>
			<ActionRow
				action={
					self ? (
						<Button asChild variant="outline">
							<Link href="/settings/account#two-factor">
								<ShieldCheck />
								{t("manageOwn")}
							</Link>
						</Button>
					) : user.twoFactorEnabled ? (
						<ConfirmDialog
							trigger={
								<Button variant="destructive">
									<ShieldOff />
									{t("reset")}
								</Button>
							}
							title={t("resetTitle")}
							description={t("resetDescription", { name: user.displayName })}
							confirmLabel={t("resetConfirm")}
							destructive
							onConfirm={reset}
						/>
					) : null
				}
			>
				<div className="flex flex-col gap-1">
					<span className="inline-flex items-center gap-2 font-medium text-foreground">
						{user.twoFactorEnabled ? (
							<ShieldCheck className="size-4 text-success" />
						) : (
							<ShieldOff className="size-4 text-muted-foreground" />
						)}
						{user.twoFactorEnabled ? t("enabled") : t("disabled")}
					</span>
					<span>{user.twoFactorEnabled ? t("enabledHint") : self ? t("disabledSelfHint") : t("disabledHint")}</span>
				</div>
			</ActionRow>
		</Section>
	);
}

function DeleteSection() {
	const t = useTranslations("userDetail");
	const router = useRouter();
	const { user, path, self, signOutSelf } = useUser();
	const locked = user.isLastActiveAdmin;

	async function remove() {
		await api.delete(path);
		toast.success(t("deleted", { name: user.displayName }));
		if (self) {
			signOutSelf();
			return;
		}
		router.push("/users");
	}

	return (
		<DangerZone
			title={t("danger")}
			description={t("dangerDescription")}
			action={
				<ConfirmDialog
					trigger={
						<Button variant="destructive" disabled={locked}>
							<Trash2 />
							{t("delete")}
						</Button>
					}
					title={t("deleteTitle")}
					description={t("deleteDescription", { name: user.displayName })}
					confirmLabel={t("deleteConfirm")}
					destructive
					onConfirm={remove}
				/>
			}
		>
			{locked ? (
				<span className="inline-flex items-start gap-2">
					<Lock className="mt-0.5 size-4 shrink-0" />
					{t("lastAdmin.delete")}
				</span>
			) : (
				t("deleteHint")
			)}
		</DangerZone>
	);
}
