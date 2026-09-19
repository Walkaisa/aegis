"use client";

import { type AuthSessionResponse, instanceNameSchema, setupRequestSchema } from "@aegis/contracts";
import { ArrowLeft, ArrowRight, Check, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ChangeEvent, type FormEvent, useState } from "react";
import { z } from "zod";
import { AuthCard } from "@/components/auth/auth-card";
import { Brand } from "@/components/brand";
import { FormField } from "@/components/form-field";
import { IconInput } from "@/components/icon-input";
import { PasswordInput } from "@/components/password-input";
import { PasswordStrength } from "@/components/password-strength";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormErrors } from "@/hooks/use-form-errors";
import { ApiRequestError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

const INITIAL_VALUES = {
	instanceName: "Aegis",
	displayName: "",
	email: "",
	password: "",
	passwordConfirmation: "",
};

type SetupField = keyof typeof INITIAL_VALUES;

const STEPS = ["instance", "account"] as const;

type Step = (typeof STEPS)[number];

const instanceStepSchema = z.object({ instanceName: instanceNameSchema });

/** First run: a two-step wizard that names the instance and creates the initial admin account. */
export function SetupForm() {
	const t = useTranslations("setup");
	const errorMessage = useErrorMessage();
	const { errors, validate, applyApiError, setFieldError } = useFormErrors();
	const [values, setValues] = useState(INITIAL_VALUES);
	const [step, setStep] = useState<Step>("instance");
	const [submitting, setSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const bind = (field: SetupField) => ({
		id: field,
		value: values[field],
		onChange: (event: ChangeEvent<HTMLInputElement>) => setValues((current) => ({ ...current, [field]: event.target.value })),
		"aria-invalid": errors[field] ? true : undefined,
	});

	const instanceName = values.instanceName.trim() || "Aegis";
	const passwordsMatch = values.passwordConfirmation.length > 0 && values.password === values.passwordConfirmation;
	const onInstanceStep = step === "instance";

	function goTo(next: Step) {
		if (next === "account" && !validate(instanceStepSchema, values)) {
			return;
		}
		setFormError(null);
		setStep(next);
	}

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (onInstanceStep) {
			goTo("account");
			return;
		}
		setFormError(null);

		const input = validate(setupRequestSchema, values);
		const mismatch = values.password !== values.passwordConfirmation;
		if (mismatch) {
			setFieldError("passwordConfirmation", "password_mismatch");
		}
		if (!input || mismatch) {
			return;
		}

		setSubmitting(true);
		try {
			await api.post<AuthSessionResponse>("/setup", input);
			window.location.assign("/");
		} catch (error) {
			setSubmitting(false);
			if (applyApiError(error)) {
				// The instance name lives on the first step; show it again if the server rejected it.
				if (error instanceof ApiRequestError && error.issues.some((issue) => issue.path === "instanceName")) {
					setStep("instance");
				}
				return;
			}
			if (error instanceof ApiRequestError && error.code === "setup_completed") {
				window.location.assign("/sign-in");
				return;
			}
			setFormError(errorMessage(error));
		}
	}

	return (
		<AuthCard
			className="max-w-[440px]"
			media={<SetupProgress step={step} onSelect={goTo} />}
			title={onInstanceStep ? t("instanceTitle") : t("accountTitle")}
			description={onInstanceStep ? t("instanceDescription") : t("accountDescription", { instance: instanceName })}
			footer={t("footer")}
		>
			<form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
				{formError ? <StatusMessage tone="error" title={formError} /> : null}

				{onInstanceStep ? (
					<FieldGroup
						key="instance"
						className="animate-in gap-5 duration-300 fade-in-0 slide-in-from-left-2 motion-reduce:animate-none"
					>
						<FormField
							id="instanceName"
							label={t("instanceName")}
							description={t("instanceNameDescription")}
							error={errors.instanceName}
						>
							<IconInput {...bind("instanceName")} autoComplete="organization" autoFocus />
						</FormField>
						<SignInPreview name={instanceName} />
					</FieldGroup>
				) : (
					<FieldGroup
						key="account"
						className="animate-in gap-5 duration-300 fade-in-0 slide-in-from-right-2 motion-reduce:animate-none"
					>
						<FormField id="displayName" label={t("displayName")} error={errors.displayName}>
							<IconInput
								{...bind("displayName")}
								icon={<UserRound />}
								autoComplete="name"
								placeholder={t("displayNamePlaceholder")}
								autoFocus
							/>
						</FormField>

						<FormField id="email" label={t("email")} error={errors.email}>
							<IconInput
								{...bind("email")}
								icon={<Mail />}
								type="email"
								autoComplete="username"
								placeholder={t("emailPlaceholder")}
							/>
						</FormField>

						<FormField id="password" label={t("password")} error={errors.password}>
							<PasswordInput {...bind("password")} className="h-9" icon={<LockKeyhole />} autoComplete="new-password" />
							<PasswordStrength password={values.password} />
						</FormField>

						<FormField
							id="passwordConfirmation"
							label={t("passwordConfirmation")}
							error={errors.passwordConfirmation}
							description={
								passwordsMatch ? (
									<span className="inline-flex items-center gap-1.5 text-success">
										<Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
										{t("passwordsMatch")}
									</span>
								) : null
							}
						>
							<PasswordInput
								{...bind("passwordConfirmation")}
								className="h-9"
								icon={<LockKeyhole />}
								autoComplete="new-password"
							/>
						</FormField>
					</FieldGroup>
				)}

				<div className="flex gap-2">
					{onInstanceStep ? null : (
						<Button
							type="button"
							variant="outline"
							size="lg"
							className="h-10 px-3.5"
							disabled={submitting}
							onClick={() => goTo("instance")}
						>
							<ArrowLeft data-icon="inline-start" />
							{t("back")}
						</Button>
					)}
					<Button type="submit" size="lg" className="group/submit h-10 flex-1 text-sm" disabled={submitting}>
						{submitting ? <Spinner /> : null}
						{onInstanceStep ? t("next") : t("submit")}
						{submitting ? null : (
							<ArrowRight
								data-icon="inline-end"
								className="transition-transform duration-200 group-hover/submit:translate-x-0.5 motion-reduce:transition-none"
							/>
						)}
					</Button>
				</div>
			</form>
		</AuthCard>
	);
}

/**
 * Horizontal progress of the wizard. Earlier steps can be revisited at any time; moving forward
 * validates the current step first.
 */
function SetupProgress({ step, onSelect }: { step: Step; onSelect: (step: Step) => void }) {
	const t = useTranslations("setup");
	const currentIndex = STEPS.indexOf(step);
	const labels: Record<Step, string> = { instance: t("instanceStep"), account: t("accountStep") };

	return (
		<nav aria-label={t("progress", { current: currentIndex + 1, total: STEPS.length })} className="w-full">
			<ol className="flex items-center gap-3">
				{STEPS.map((item, index) => {
					const state = index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
					return (
						<li key={item} className={cn("flex items-center gap-3", index > 0 && "flex-1")}>
							{index > 0 ? (
								<span aria-hidden="true" className="relative h-px flex-1 overflow-hidden rounded-full bg-border">
									<span
										className={cn(
											"absolute inset-0 origin-left bg-primary transition-transform duration-500 ease-out motion-reduce:transition-none",
											index <= currentIndex ? "scale-x-100" : "scale-x-0",
										)}
									/>
								</span>
							) : null}
							<button
								type="button"
								onClick={() => onSelect(item)}
								aria-current={state === "current" ? "step" : undefined}
								className="group/step flex shrink-0 items-center gap-2 rounded-full py-0.5 pr-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
							>
								<span
									className={cn(
										"flex size-6 items-center justify-center rounded-full border text-[0.6875rem] font-semibold tabular-nums transition-[background-color,border-color,color,box-shadow] duration-300 motion-reduce:transition-none",
										state === "complete" && "border-primary bg-primary text-primary-foreground",
										state === "current" && "border-primary text-primary ring-4 ring-primary/15",
										state === "upcoming" && "bg-muted/60 text-muted-foreground group-hover/step:text-foreground",
									)}
								>
									{state === "complete" ? <Check aria-hidden="true" className="size-3" strokeWidth={3} /> : index + 1}
								</span>
								<span
									className={cn(
										"text-xs font-medium transition-colors",
										state === "upcoming" ? "text-muted-foreground group-hover/step:text-foreground" : "text-foreground",
									)}
								>
									{labels[item]}
									{state === "complete" ? <span className="sr-only">, {t("stepComplete")}</span> : null}
								</span>
							</button>
						</li>
					);
				})}
			</ol>
		</nav>
	);
}

/** A miniature of the sign-in page showing the instance name as it will appear there. */
function SignInPreview({ name }: { name: string }) {
	const t = useTranslations("setup");

	return (
		<figure className="overflow-hidden rounded-xl border bg-muted/30">
			<figcaption className="border-b px-3.5 py-2 text-xs text-muted-foreground">{t("preview")}</figcaption>
			<div aria-hidden="true" className="relative isolate flex flex-col items-center gap-3 px-6 pt-5 pb-6">
				<div className="auth-glow absolute inset-0 -z-10 opacity-70" />
				<Brand name={name} className="max-w-full" />
				<div className="flex w-full max-w-56 flex-col items-center gap-2 rounded-lg border bg-card px-4 py-3.5 shadow-sm">
					<span className="mb-0.5 text-xs font-semibold">{t("previewHeading")}</span>
					<span className="h-5 w-full rounded-md border bg-muted/40" />
					<span className="h-5 w-full rounded-md border bg-muted/40" />
					<span className="h-5 w-full rounded-md bg-primary/80" />
				</div>
			</div>
		</figure>
	);
}
