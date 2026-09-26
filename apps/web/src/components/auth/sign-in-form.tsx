"use client";

import { type AdminSignInResponse, type InstanceInfo, type SecondFactorPrompt, signInRequestSchema } from "@aegis/contracts";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordLink } from "@/components/auth/forgot-password-link";
import { FormField } from "@/components/form-field";
import { IconInput } from "@/components/icon-input";
import { PasswordInput } from "@/components/password-input";
import { StatusMessage } from "@/components/status-message";
import { SecondFactorStep } from "@/components/two-factor/second-factor-step";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useApiQuery } from "@/hooks/use-api-query";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormErrors } from "@/hooks/use-form-errors";
import { ApiRequestError, api } from "@/lib/api";
import { safeAdminPath } from "@/lib/navigation";

function continueToAdministration() {
	const next = new URLSearchParams(window.location.search).get("next");
	window.location.assign(safeAdminPath(next));
}

/**
 * Sign-in to the administration UI. The server only accepts accounts with `console:access`; accounts
 * with two-factor authentication confirm a code after the password.
 */
export function SignInForm() {
	const t = useTranslations("signIn");
	const errorMessage = useErrorMessage();
	const { data: instance } = useApiQuery<InstanceInfo>("/instance");
	const { errors, validate, applyApiError } = useFormErrors();
	const [values, setValues] = useState({ email: "", password: "" });
	const [submitting, setSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [secondFactor, setSecondFactor] = useState<SecondFactorPrompt | null>(null);

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);

		const input = validate(signInRequestSchema, values);
		if (!input) {
			return;
		}

		setSubmitting(true);
		try {
			const result = await api.post<AdminSignInResponse>("/auth/session", input);
			if (result.type === "second_factor") {
				setSubmitting(false);
				setSecondFactor(result);
				return;
			}
			continueToAdministration();
		} catch (error) {
			setSubmitting(false);
			if (applyApiError(error)) {
				return;
			}
			if (error instanceof ApiRequestError && error.code === "setup_required") {
				window.location.assign("/setup");
				return;
			}
			setFormError(error instanceof ApiRequestError && error.code === "forbidden" ? t("forbidden") : errorMessage(error));
			setValues((current) => ({ ...current, password: "" }));
		}
	}

	const instanceName = instance?.instanceName ?? "Aegis";
	const footer = (
		<span className="inline-flex items-start gap-2 text-left">
			<ShieldCheck aria-hidden="true" className="mt-px size-3.5 shrink-0" />
			{t("footer")}
		</span>
	);

	if (secondFactor) {
		return (
			<SecondFactorStep
				prompt={secondFactor}
				brandName={instanceName}
				footer={footer}
				onSubmit={async (code) => {
					await api.post<AdminSignInResponse>("/auth/session/second-factor", { code });
					continueToAdministration();
				}}
				onRestart={(message) => {
					setSecondFactor(null);
					setValues((current) => ({ ...current, password: "" }));
					setFormError(message ?? null);
				}}
			/>
		);
	}

	return (
		<AuthCard brandName={instanceName} title={t("title")} description={t("description", { instance: instanceName })} footer={footer}>
			<form onSubmit={onSubmit} noValidate>
				<FieldGroup>
					{formError ? <StatusMessage tone="error" title={formError} /> : null}

					<FormField id="email" label={t("email")} error={errors.email}>
						<IconInput
							id="email"
							icon={<Mail />}
							type="email"
							autoComplete="username"
							placeholder={t("emailPlaceholder")}
							autoFocus={!values.email}
							value={values.email}
							onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
							aria-invalid={errors.email ? true : undefined}
						/>
					</FormField>

					<FormField id="password" label={t("password")} error={errors.password}>
						<PasswordInput
							id="password"
							className="h-9"
							icon={<LockKeyhole />}
							autoComplete="current-password"
							autoFocus={Boolean(values.email)}
							value={values.password}
							onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
							aria-invalid={errors.password ? true : undefined}
						/>
					</FormField>

					{instance?.passwordResetEnabled ? <ForgotPasswordLink /> : null}

					<Button type="submit" size="lg" className="group/submit mt-1 h-10 w-full text-sm" disabled={submitting}>
						{submitting ? <Spinner /> : null}
						{t("submit")}
						{submitting ? null : (
							<ArrowRight
								data-icon="inline-end"
								className="transition-transform duration-200 group-hover/submit:translate-x-0.5 motion-reduce:transition-none"
							/>
						)}
					</Button>
				</FieldGroup>
			</form>
		</AuthCard>
	);
}
