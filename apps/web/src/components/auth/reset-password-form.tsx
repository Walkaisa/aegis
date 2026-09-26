"use client";

import { type InstanceInfo, type PasswordResetTokenDto, passwordResetConfirmSchema, verificationLinkSchema } from "@aegis/contracts";
import { CircleCheck, LockKeyhole, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { AuthCard, AuthStatus } from "@/components/auth/auth-card";
import { FormField } from "@/components/form-field";
import { PasswordInput } from "@/components/password-input";
import { PasswordStrength } from "@/components/password-strength";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useApiQuery } from "@/hooks/use-api-query";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useLinkToken } from "@/hooks/use-link-token";
import { ApiRequestError, api } from "@/lib/api";
import { useDateFormat } from "@/lib/format";

type LinkState =
	| { status: "checking" }
	| { status: "valid"; link: PasswordResetTokenDto }
	| { status: "invalid" }
	| { status: "failed"; error: unknown };

function isInvalidLink(error: unknown): boolean {
	return error instanceof ApiRequestError && (error.code === "verification_token_invalid" || error.code === "validation_failed");
}

/**
 * Redeems a reset link. The token is checked before the form appears, so an expired link says so
 * straight away instead of after a password has been typed twice.
 */
export function ResetPasswordForm() {
	const t = useTranslations("resetPassword");
	const tCommon = useTranslations("common");
	const dates = useDateFormat();
	const errorMessage = useErrorMessage();
	const { data: instance } = useApiQuery<InstanceInfo>("/instance");
	const { errors, validate, applyApiError, setFieldError } = useFormErrors();
	const token = useLinkToken();
	const [state, setState] = useState<LinkState>({ status: "checking" });
	const [values, setValues] = useState({ password: "", confirmation: "" });
	const [submitting, setSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [done, setDone] = useState(false);

	useEffect(() => {
		if (token === undefined) {
			return;
		}
		const input = verificationLinkSchema.safeParse({ token });
		if (!input.success) {
			setState({ status: "invalid" });
			return;
		}

		let active = true;
		api.post<PasswordResetTokenDto>("/auth/password-reset/validate", input.data).then(
			(link) => {
				if (active) {
					setState({ status: "valid", link });
				}
			},
			(error: unknown) => {
				if (active) {
					setState(isInvalidLink(error) ? { status: "invalid" } : { status: "failed", error });
				}
			},
		);
		return () => {
			active = false;
		};
	}, [token]);

	const instanceName = instance?.instanceName ?? "Aegis";
	const footer = (
		<span className="inline-flex items-start gap-2 text-left">
			<ShieldCheck aria-hidden="true" className="mt-px size-3.5 shrink-0" />
			{t("footer")}
		</span>
	);

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);

		const input = validate(passwordResetConfirmSchema, { token, password: values.password });
		const mismatch = values.password !== values.confirmation;
		if (mismatch) {
			setFieldError("confirmation", "password_mismatch");
		}
		if (!input || mismatch) {
			return;
		}

		setSubmitting(true);
		try {
			await api.post("/auth/password-reset/confirm", input);
			setDone(true);
		} catch (error) {
			if (!applyApiError(error)) {
				setFormError(errorMessage(error));
			}
		} finally {
			setSubmitting(false);
		}
	}

	if (done) {
		return (
			<AuthCard brandName={instanceName} icon={<CircleCheck />} title={t("successTitle")} footer={footer}>
				<div className="flex flex-col gap-5">
					<StatusMessage tone="success" title={t("successDescription")} />
					<Button asChild size="lg" className="h-10 w-full text-sm">
						<Link href="/sign-in">{t("signIn")}</Link>
					</Button>
				</div>
			</AuthCard>
		);
	}

	if (state.status === "invalid") {
		return (
			<AuthCard
				brandName={instanceName}
				icon={<TriangleAlert />}
				title={t("invalidTitle")}
				description={t("invalidDescription")}
				footer={footer}
			>
				<div className="flex flex-col gap-2">
					<Button asChild size="lg" className="h-10 w-full text-sm">
						<Link href="/forgot-password">{t("request")}</Link>
					</Button>
					<Button asChild variant="ghost" className="w-full">
						<Link href="/sign-in">{t("signIn")}</Link>
					</Button>
				</div>
			</AuthCard>
		);
	}

	if (state.status === "failed") {
		return (
			<AuthCard brandName={instanceName} icon={<TriangleAlert />} title={t("title")} footer={footer}>
				<div className="flex flex-col gap-5">
					<StatusMessage tone="error" title={errorMessage(state.error)} />
					<Button type="button" size="lg" className="h-10 w-full text-sm" onClick={() => window.location.reload()}>
						{tCommon("retry")}
					</Button>
				</div>
			</AuthCard>
		);
	}

	if (state.status === "checking") {
		return (
			<AuthCard brandName={instanceName} title={t("title")}>
				<AuthStatus>
					<Spinner />
					{t("checking")}
				</AuthStatus>
			</AuthCard>
		);
	}

	return (
		<AuthCard
			brandName={instanceName}
			icon={<LockKeyhole />}
			title={t("title")}
			description={t("description", { email: state.link.maskedEmail })}
			footer={footer}
		>
			<form onSubmit={onSubmit} noValidate>
				<FieldGroup>
					{formError ? <StatusMessage tone="error" title={formError} /> : null}

					<FormField id="reset-password" label={t("newPassword")} error={errors.password}>
						<PasswordInput
							id="reset-password"
							className="h-9"
							autoComplete="new-password"
							autoFocus
							value={values.password}
							onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
							aria-invalid={errors.password ? true : undefined}
						/>
					</FormField>

					<FormField id="reset-confirmation" label={t("confirmPassword")} error={errors.confirmation}>
						<PasswordInput
							id="reset-confirmation"
							className="h-9"
							autoComplete="new-password"
							value={values.confirmation}
							onChange={(event) => setValues((current) => ({ ...current, confirmation: event.target.value }))}
							aria-invalid={errors.confirmation ? true : undefined}
						/>
					</FormField>

					<PasswordStrength password={values.password} />

					<Button type="submit" size="lg" className="mt-1 h-10 w-full text-sm" disabled={submitting}>
						{submitting ? <Spinner /> : null}
						{t("submit")}
					</Button>

					<p className="text-center text-xs text-muted-foreground">
						{t("expires", { date: dates.dateTime(state.link.expiresAt) })}
					</p>
				</FieldGroup>
			</form>
		</AuthCard>
	);
}
