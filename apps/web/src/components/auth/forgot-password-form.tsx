"use client";

import { type ForgotPasswordRequest, forgotPasswordSchema, type InstanceInfo } from "@aegis/contracts";
import { ArrowLeft, KeyRound, Mail, MailCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/form-field";
import { IconInput } from "@/components/icon-input";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useApiQuery } from "@/hooks/use-api-query";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormErrors } from "@/hooks/use-form-errors";
import { api } from "@/lib/api";

/**
 * Asks for a password reset link. The server answers the same way whether or not an account
 * exists, and so does this page: the confirmation below never says that an account was found.
 * Coming from an application's sign-in (`challenge`), the way back leads there again.
 */
export function ForgotPasswordForm({ challenge }: { challenge: string | null }) {
	const t = useTranslations("forgotPassword");
	const errorMessage = useErrorMessage();
	const { data: instance } = useApiQuery<InstanceInfo>("/instance");
	const { errors, validate, applyApiError } = useFormErrors();
	const [email, setEmail] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [sentTo, setSentTo] = useState<string | null>(null);

	const instanceName = instance?.instanceName ?? "Aegis";
	const signIn = challenge ? `/sign-in?challenge=${encodeURIComponent(challenge)}` : "/sign-in";
	const footer = (
		<span className="inline-flex items-start gap-2 text-left">
			<ShieldCheck aria-hidden="true" className="mt-px size-3.5 shrink-0" />
			{t("footer")}
		</span>
	);

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);

		const input: ForgotPasswordRequest | null = validate(forgotPasswordSchema, { email });
		if (!input) {
			return;
		}

		setSubmitting(true);
		try {
			await api.post("/auth/password-reset", input);
			setSentTo(input.email);
		} catch (error) {
			if (!applyApiError(error)) {
				setFormError(errorMessage(error));
			}
		} finally {
			setSubmitting(false);
		}
	}

	if (sentTo) {
		return (
			<AuthCard brandName={instanceName} icon={<MailCheck />} title={t("sentTitle")} footer={footer}>
				<div className="flex flex-col gap-5">
					<StatusMessage tone="success" title={t("sentDescription", { email: sentTo })}>
						{t("sentHint")}
					</StatusMessage>
					<div className="flex flex-col gap-2">
						<Button
							type="button"
							variant="outline"
							className="w-full"
							onClick={() => {
								setSentTo(null);
								setEmail("");
							}}
						>
							{t("again")}
						</Button>
						<BackLink href={signIn} label={t("back")} />
					</div>
				</div>
			</AuthCard>
		);
	}

	return (
		<AuthCard brandName={instanceName} icon={<KeyRound />} title={t("title")} description={t("description")} footer={footer}>
			<form onSubmit={onSubmit} noValidate>
				<FieldGroup>
					{formError ? <StatusMessage tone="error" title={formError} /> : null}

					<FormField id="forgot-email" label={t("email")} error={errors.email}>
						<IconInput
							id="forgot-email"
							icon={<Mail />}
							type="email"
							autoComplete="username"
							autoFocus
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							aria-invalid={errors.email ? true : undefined}
						/>
					</FormField>

					<Button type="submit" size="lg" className="mt-1 h-10 w-full text-sm" disabled={submitting}>
						{submitting ? <Spinner /> : null}
						{t("submit")}
					</Button>
					<BackLink href={signIn} label={t("back")} />
				</FieldGroup>
			</form>
		</AuthCard>
	);
}

function BackLink({ href, label }: { href: string; label: string }) {
	return (
		<Link
			href={href}
			className="inline-flex items-center justify-center gap-1.5 rounded-md py-1 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
		>
			<ArrowLeft className="size-4" />
			{label}
		</Link>
	);
}
