"use client";

import {
	type ClientWithSecretResponse,
	classifyRedirectUri,
	clientCreateSchema,
	type InstanceInfo,
	PKCE_POLICIES_BY_TYPE,
	type PkcePolicy,
	SUPPORTED_SCOPES,
	type SupportedScope,
} from "@aegis/contracts";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Lightbulb } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { AppAvatar } from "@/components/app-avatar";
import { PkcePolicyField } from "@/components/applications/client-form";
import { ScopeSelector } from "@/components/applications/scope-selector";
import { CodeBlock } from "@/components/code-block";
import { CopyField } from "@/components/copy-button";
import { BackLink, Page, PageHeader } from "@/components/dashboard/page";
import { FormField } from "@/components/form-field";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useApiQuery } from "@/hooks/use-api-query";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormErrors } from "@/hooks/use-form-errors";
import { api } from "@/lib/api";
import {
	APPLICATION_KINDS,
	type ApplicationKind,
	buildSnippets,
	INTEGRATIONS,
	type IntegrationId,
	integrationsFor,
	joinUrl,
	KIND_ICONS,
} from "@/lib/applications";
import { cn } from "@/lib/utils";

const STEPS = ["type", "configure", "credentials"] as const;
type Step = (typeof STEPS)[number];

const OPTION_CARD =
	"cursor-pointer rounded-xl border bg-card transition-colors hover:bg-muted/40 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:ring-3 has-data-[state=checked]:ring-primary/15";

const URL_INPUT_PROPS = {
	type: "url",
	inputMode: "url",
	autoCapitalize: "none",
	autoCorrect: "off",
	spellCheck: false,
	className: "font-mono text-[13px]",
} as const;

const clientTypeOf = (kind: ApplicationKind) => (kind === "web" ? "confidential" : "public");

/** Three-step wizard modelled on the application setup of large identity providers. */
export function NewApplicationPage({ initialKind }: { initialKind: ApplicationKind }) {
	const t = useTranslations("newApplication");
	const tKinds = useTranslations("applicationKinds");
	const router = useRouter();
	const errorMessage = useErrorMessage();
	const { errors, validate, applyApiError, setFieldError, clear } = useFormErrors();
	const { data: instance } = useApiQuery<InstanceInfo>("/instance");

	const [step, setStep] = useState<Step>("type");
	const [name, setName] = useState("");
	const [kind, setKind] = useState<ApplicationKind>(initialKind);
	const [integrationId, setIntegrationId] = useState<IntegrationId>(() => integrationsFor(initialKind)[0]?.id ?? "generic");
	const [baseUrl, setBaseUrl] = useState("");
	const [redirectOverride, setRedirectOverride] = useState<string | null>(null);
	const [signOutOverride, setSignOutOverride] = useState<string | null>(null);
	const [allowedScopes, setAllowedScopes] = useState<SupportedScope[]>([...SUPPORTED_SCOPES]);
	const [skipConsent, setSkipConsent] = useState(true);
	const [pkcePolicy, setPkcePolicy] = useState<PkcePolicy>(PKCE_POLICIES_BY_TYPE[clientTypeOf(initialKind)][0]);
	const [submitting, setSubmitting] = useState(false);
	const [created, setCreated] = useState<ClientWithSecretResponse | null>(null);
	const [confirmed, setConfirmed] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const integration = INTEGRATIONS.find((entry) => entry.id === integrationId) ?? INTEGRATIONS[0];
	const integrationName = integration?.name ?? t("genericIntegration");
	const usesBaseUrl = kind !== "native";
	const redirectUri = redirectOverride ?? (usesBaseUrl ? joinUrl(baseUrl, integration?.callbackPath ?? "") : "");
	const signOutUri = signOutOverride ?? (usesBaseUrl ? joinUrl(baseUrl, integration?.signOutPath ?? "") : "");

	function selectKind(next: ApplicationKind) {
		setKind(next);
		setPkcePolicy(PKCE_POLICIES_BY_TYPE[clientTypeOf(next)][0]);
		setIntegrationId(integrationsFor(next)[0]?.id ?? "generic");
		setRedirectOverride(null);
		setSignOutOverride(null);
	}

	function selectIntegration(next: IntegrationId) {
		setIntegrationId(next);
		setRedirectOverride(null);
		setSignOutOverride(null);
	}

	function continueToConfiguration(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const trimmed = name.trim();
		if (!trimmed || trimmed.length > 100) {
			setFieldError("name", trimmed ? "too_long" : "required");
			return;
		}
		clear();
		setStep("configure");
	}

	async function create(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);

		// The base URL is only a convenience for building the two URIs, so it is checked separately.
		const base = baseUrl.trim();
		if (usesBaseUrl && base.length > 0) {
			const result = classifyRedirectUri(base);
			if (!result.ok) {
				setFieldError("baseUrl", result.code);
				return;
			}
		}

		const input = validate(clientCreateSchema, {
			name,
			description: "",
			type: clientTypeOf(kind),
			tokenEndpointAuthMethod: "client_secret_basic",
			redirectUris: [redirectUri.trim()],
			postLogoutRedirectUris: signOutUri.trim() ? [signOutUri.trim()] : [],
			allowedScopes,
			skipConsent: kind === "native" ? false : skipConsent,
			pkcePolicy,
		});
		if (!input) {
			return;
		}

		setSubmitting(true);
		try {
			setCreated(await api.post<ClientWithSecretResponse>("/applications", input));
			setStep("credentials");
		} catch (error) {
			if (!applyApiError(error)) {
				setFormError(errorMessage(error));
			}
		} finally {
			setSubmitting(false);
		}
	}

	const redirectError = errors["redirectUris.0"] ?? errors.redirectUris;

	return (
		<Page>
			<PageHeader
				back={<BackLink href="/applications">{t("backToApplications")}</BackLink>}
				title={t("title")}
				description={t("description")}
				actions={<Stepper current={step} />}
			/>

			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
				<div className="min-w-0">
					{step === "type" ? (
						<form onSubmit={continueToConfiguration} noValidate>
							<Card className="gap-0 py-0">
								<CardContent className="flex flex-col gap-8 py-6">
									<FormField id="app-name" label={t("name")} description={t("nameDescription")} error={errors.name}>
										<Input
											id="app-name"
											value={name}
											autoFocus
											maxLength={100}
											placeholder={t("namePlaceholder")}
											onChange={(event) => setName(event.target.value)}
											aria-invalid={errors.name ? true : undefined}
										/>
									</FormField>

									<fieldset className="flex flex-col gap-3">
										<legend className="mb-3 flex flex-col gap-0.5">
											<span className="text-sm font-medium">{t("kindHeading")}</span>
											<span className="text-sm text-muted-foreground">{t("kindDescription")}</span>
										</legend>
										<RadioGroup
											value={kind}
											onValueChange={(value) => selectKind(value as ApplicationKind)}
											className="grid gap-3 md:grid-cols-3"
										>
											{APPLICATION_KINDS.map((option) => {
												const Icon = KIND_ICONS[option];
												return (
													<label
														key={option}
														htmlFor={`kind-${option}`}
														className={cn(OPTION_CARD, "flex flex-col gap-3 p-4")}
													>
														<span className="flex items-start justify-between gap-2">
															<span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
																<Icon className="size-5" />
															</span>
															<RadioGroupItem value={option} id={`kind-${option}`} />
														</span>
														<span className="flex flex-col gap-1">
															<span className="font-medium">{tKinds(`${option}.title`)}</span>
															<span className="text-sm text-muted-foreground">
																{tKinds(`${option}.description`)}
															</span>
														</span>
														<span className="mt-auto text-xs text-muted-foreground">
															{tKinds(`${option}.examples`)}
														</span>
													</label>
												);
											})}
										</RadioGroup>
									</fieldset>
								</CardContent>
								<CardFooter className="justify-between gap-2 py-3">
									<Button asChild variant="ghost">
										<Link href="/applications">{t("cancel")}</Link>
									</Button>
									<Button type="submit">
										{t("next")}
										<ArrowRight />
									</Button>
								</CardFooter>
							</Card>
						</form>
					) : null}

					{step === "configure" ? (
						<form onSubmit={create} noValidate>
							<Card className="gap-0 py-0">
								<CardContent className="flex flex-col gap-8 py-6">
									<div className="flex items-center gap-3">
										<AppAvatar name={name} />
										<div className="min-w-0">
											<p className="truncate font-medium">{name}</p>
											<p className="text-sm text-muted-foreground">{tKinds(`${kind}.title`)}</p>
										</div>
									</div>

									{formError ? <StatusMessage tone="error" title={formError} /> : null}

									<fieldset className="flex flex-col">
										<legend className="mb-3 flex flex-col gap-0.5">
											<span className="text-sm font-medium">{t("integrationHeading")}</span>
											<span className="text-sm text-muted-foreground">{t("integrationDescription")}</span>
										</legend>
										<RadioGroup
											value={integrationId}
											onValueChange={(value) => selectIntegration(value as IntegrationId)}
											className="grid gap-2 sm:grid-cols-2"
										>
											{integrationsFor(kind).map((entry) => (
												<label
													key={entry.id}
													htmlFor={`integration-${entry.id}`}
													className={cn(OPTION_CARD, "flex items-center gap-3 px-3 py-2.5 text-sm")}
												>
													<RadioGroupItem value={entry.id} id={`integration-${entry.id}`} />
													<span className="font-medium">{entry.name ?? t("genericIntegration")}</span>
												</label>
											))}
										</RadioGroup>
									</fieldset>

									<FieldGroup>
										{usesBaseUrl ? (
											<FormField
												id="app-base-url"
												label={t("baseUrl")}
												description={t("baseUrlDescription")}
												error={errors.baseUrl}
											>
												<Input
													id="app-base-url"
													value={baseUrl}
													placeholder="https://app.example.com"
													onChange={(event) => setBaseUrl(event.target.value)}
													aria-invalid={errors.baseUrl ? true : undefined}
													{...URL_INPUT_PROPS}
												/>
											</FormField>
										) : null}

										<FormField
											id="app-redirect-uri"
											label={t("redirectUri")}
											description={usesBaseUrl ? t("redirectUriAutoDescription") : t("redirectUriDescription")}
											error={redirectError}
										>
											<Input
												id="app-redirect-uri"
												value={redirectUri}
												placeholder={
													usesBaseUrl
														? `https://app.example.com${integration?.callbackPath ?? ""}`
														: "com.example.app:/callback"
												}
												onChange={(event) => setRedirectOverride(event.target.value)}
												aria-invalid={redirectError ? true : undefined}
												{...URL_INPUT_PROPS}
											/>
										</FormField>

										<FormField
											id="app-sign-out-uri"
											label={t("signOutUri")}
											description={t("signOutUriDescription")}
											error={errors["postLogoutRedirectUris.0"]}
										>
											<Input
												id="app-sign-out-uri"
												value={signOutUri}
												placeholder={usesBaseUrl ? "https://app.example.com" : ""}
												onChange={(event) => setSignOutOverride(event.target.value)}
												aria-invalid={errors["postLogoutRedirectUris.0"] ? true : undefined}
												{...URL_INPUT_PROPS}
											/>
										</FormField>

										<FieldDescription>{t("moreUrisHint")}</FieldDescription>

										<FieldSeparator />

										<Field>
											<FieldLabel>{t("scopesHeading")}</FieldLabel>
											<FieldDescription>{t("scopesDescription")}</FieldDescription>
											<ScopeSelector value={allowedScopes} onChange={setAllowedScopes} idPrefix="new-application" />
										</Field>

										<FieldSeparator />

										<PkcePolicyField
											id="app-pkce-policy"
											type={clientTypeOf(kind)}
											value={pkcePolicy}
											onChange={setPkcePolicy}
											error={errors.pkcePolicy}
										/>

										{kind === "native" ? null : (
											<>
												<FieldSeparator />
												<Field orientation="horizontal">
													<FieldContent>
														<FieldLabel htmlFor="app-skip-consent">{t("skipConsent")}</FieldLabel>
														<FieldDescription>{t("skipConsentDescription")}</FieldDescription>
													</FieldContent>
													<Switch id="app-skip-consent" checked={skipConsent} onCheckedChange={setSkipConsent} />
												</Field>
											</>
										)}
									</FieldGroup>
								</CardContent>
								<CardFooter className="justify-between gap-2 py-3">
									<Button type="button" variant="ghost" onClick={() => setStep("type")}>
										<ArrowLeft />
										{t("previous")}
									</Button>
									<Button type="submit" disabled={submitting}>
										{submitting ? <Spinner /> : null}
										{t("create")}
									</Button>
								</CardFooter>
							</Card>
						</form>
					) : null}

					{step === "credentials" && created ? (
						<Card className="gap-0 py-0">
							<CardContent className="flex flex-col gap-7 py-6">
								<StatusMessage tone="success" icon={<CircleCheck />} title={t("done.title", { name: created.client.name })}>
									{t("done.description")}
								</StatusMessage>

								<FieldGroup className="gap-5">
									<Field>
										<FieldLabel htmlFor="created-issuer">{t("done.issuer")}</FieldLabel>
										<CopyField id="created-issuer" value={instance?.issuer ?? ""} />
									</Field>
									<Field>
										<FieldLabel htmlFor="created-client-id">{t("done.clientId")}</FieldLabel>
										<CopyField id="created-client-id" value={created.client.id} />
									</Field>
									{created.clientSecret ? (
										<Field>
											<FieldLabel htmlFor="created-client-secret">{t("done.clientSecret")}</FieldLabel>
											<CopyField id="created-client-secret" value={created.clientSecret} />
										</Field>
									) : null}
								</FieldGroup>

								{created.clientSecret ? (
									<StatusMessage tone="warning" title={t("done.secretWarningTitle")}>
										{t("done.secretWarning")}
									</StatusMessage>
								) : (
									<StatusMessage tone="info" title={t("done.publicNoticeTitle")}>
										{t("done.publicNotice")}
									</StatusMessage>
								)}

								<div className="flex flex-col gap-3">
									<h3 className="text-sm font-medium">{t("done.snippetHeading", { integration: integrationName })}</h3>
									{buildSnippets(integrationId, {
										issuer: instance?.issuer ?? "",
										clientId: created.client.id,
										clientSecret: created.clientSecret,
										redirectUri: created.client.redirectUris[0] ?? "",
										postSignOutRedirectUri: created.client.postLogoutRedirectUris[0] ?? null,
										scopes: created.client.allowedScopes,
									}).map((snippet) => (
										<CodeBlock key={snippet.file} file={snippet.file} code={snippet.code} />
									))}
								</div>
							</CardContent>
							<CardFooter className="flex-col items-stretch gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
								{created.clientSecret ? (
									<Field orientation="horizontal" className="w-auto">
										<Checkbox
											id="created-confirm"
											checked={confirmed}
											onCheckedChange={(checked) => setConfirmed(checked === true)}
										/>
										<FieldLabel htmlFor="created-confirm" className="font-normal">
											{t("done.confirm")}
										</FieldLabel>
									</Field>
								) : (
									<span />
								)}
								<Button
									disabled={Boolean(created.clientSecret) && !confirmed}
									onClick={() => router.push(`/applications/${created.client.id}`)}
								>
									{t("done.openApplication")}
									<ArrowRight />
								</Button>
							</CardFooter>
						</Card>
					) : null}
				</div>

				<HelpPanel step={step} />
			</div>
		</Page>
	);
}

function Stepper({ current }: { current: Step }) {
	const t = useTranslations("newApplication");
	const currentIndex = STEPS.indexOf(current);

	return (
		<ol className="flex items-center gap-2">
			{STEPS.map((step, index) => (
				<li key={step} className="flex items-center gap-2">
					<span
						className={cn(
							"flex size-7 items-center justify-center rounded-full border text-xs font-medium transition-colors",
							index < currentIndex && "border-primary bg-primary text-primary-foreground",
							index === currentIndex && "border-primary text-primary ring-4 ring-primary/15",
							index > currentIndex && "text-muted-foreground",
						)}
						aria-current={index === currentIndex ? "step" : undefined}
					>
						{index < currentIndex ? <Check className="size-3.5" /> : index + 1}
					</span>
					<span className={cn("hidden text-sm xl:inline", index === currentIndex ? "font-medium" : "text-muted-foreground")}>
						{t(`steps.${step}`)}
					</span>
					{index < STEPS.length - 1 ? <span className="h-px w-5 bg-border sm:w-8" /> : null}
				</li>
			))}
		</ol>
	);
}

function HelpPanel({ step }: { step: Step }) {
	const t = useTranslations("newApplication");

	return (
		<aside className="hidden lg:block">
			<div className="sticky top-20 flex flex-col gap-3 rounded-xl border bg-muted/30 p-5 text-sm">
				<span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
					<Lightbulb className="size-4" />
				</span>
				<p className="font-medium">{t(`help.${step}.title`)}</p>
				<p className="text-muted-foreground">{t(`help.${step}.body`)}</p>
			</div>
		</aside>
	);
}
