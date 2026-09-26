"use client";

import {
	type AuthRequestClient,
	type AuthRequestConsentPrompt,
	type AuthRequestContextResponse,
	type AuthRequestRedirect,
	type AuthRequestSecondFactorPrompt,
	type AuthRequestSignInPrompt,
	type AuthRequestSignInResponse,
	type SecondFactorPrompt,
	signInRequestSchema,
} from "@aegis/contracts";
import {
	ArrowLeftRight,
	ChevronDown,
	CircleAlert,
	Clock,
	Fingerprint,
	Info,
	Mail,
	SearchX,
	ShieldAlert,
	ShieldCheck,
	UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { AppAvatar } from "@/components/app-avatar";
import { AuthCard, AuthStatus } from "@/components/auth/auth-card";
import { ForgotPasswordLink } from "@/components/auth/forgot-password-link";
import { BrandMark } from "@/components/brand";
import { FormField } from "@/components/form-field";
import { PasswordInput } from "@/components/password-input";
import { SecondFactorStep } from "@/components/two-factor/second-factor-step";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { UserAvatar } from "@/components/users/account-badges";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormErrors } from "@/hooks/use-form-errors";
import { ApiRequestError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

type FlowState =
	| { status: "loading" }
	| { status: "redirecting" }
	| { status: "error"; code: string }
	| { status: "sign_in"; context: AuthRequestSignInPrompt }
	| { status: "second_factor"; context: AuthRequestSecondFactorPrompt }
	| { status: "consent"; context: AuthRequestConsentPrompt };

interface PromptProps<T> {
	context: T;
	basePath: string;
	onRedirect: (redirect: AuthRequestRedirect) => void;
	onError: (error: unknown) => void;
}

const SCOPE_ICONS: Record<string, ReactNode> = {
	openid: <Fingerprint />,
	profile: <UserRound />,
	email: <Mail />,
};

/** What an application may read, one row per scope. */
function ScopeList({ scopes, className }: { scopes: string[]; className?: string }) {
	const t = useTranslations("scopes");

	return (
		<ul className={cn("divide-y", className)}>
			{scopes.map((scope) => (
				<li key={scope} className="flex items-start gap-3 px-3 py-3 text-sm">
					<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4">
						{SCOPE_ICONS[scope] ?? <Info />}
					</span>
					<span className="flex min-w-0 flex-col">
						<span className="font-medium">{t.has(`${scope}.title`) ? t(`${scope}.title`) : scope}</span>
						{t.has(`${scope}.description`) ? <span className="text-muted-foreground">{t(`${scope}.description`)}</span> : null}
					</span>
				</li>
			))}
		</ul>
	);
}

/**
 * Collapsed overview of the requested access below the sign-in form. Trusted applications skip the
 * consent step, so this is the only place where a user sees what they get.
 */
function AccessDisclosure({ scopes }: { scopes: string[] }) {
	const t = useTranslations("authRequest");

	if (scopes.length === 0) {
		return null;
	}

	return (
		<details className="group overflow-hidden rounded-xl border bg-muted/30 text-left">
			<summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 text-sm outline-none select-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
				<ShieldCheck className="size-4 shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1 truncate">{t("signIn.access")}</span>
				<span aria-hidden="true" className="flex -space-x-1.5">
					{scopes.map((scope) => (
						<span
							key={scope}
							className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary ring-2 ring-background [&_svg]:size-3"
						>
							{SCOPE_ICONS[scope] ?? <Info />}
						</span>
					))}
				</span>
				<ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
			</summary>
			<ScopeList scopes={scopes} className="border-t bg-background" />
		</details>
	);
}

function errorCodeOf(error: unknown): string {
	return error instanceof ApiRequestError ? error.code : "internal_error";
}

/**
 * Renders the pending prompt of an OIDC authorization request. oidc-provider decides whether a
 * sign-in or a consent is due; the page URL only carries the request identifier (`?challenge=`).
 * Only user accounts can complete it – the server rejects admin accounts.
 */
export function AuthRequestFlow({ challenge }: { challenge: string | null }) {
	const t = useTranslations("authRequest");
	const [state, setState] = useState<FlowState>(challenge ? { status: "loading" } : { status: "error", code: "missing" });
	const started = useRef(false);
	const basePath = `/auth/requests/${encodeURIComponent(challenge ?? "")}`;

	const onRedirect = useCallback((redirect: AuthRequestRedirect) => {
		setState({ status: "redirecting" });
		window.location.assign(redirect.redirectTo);
	}, []);

	const onError = useCallback((error: unknown) => {
		setState({ status: "error", code: errorCodeOf(error) });
	}, []);

	useEffect(() => {
		if (!challenge || started.current) {
			return;
		}
		started.current = true;

		api.get<AuthRequestContextResponse>(basePath)
			.then((context) => {
				if (context.type === "redirect") {
					onRedirect(context);
				} else if (context.type === "sign_in") {
					setState({ status: "sign_in", context });
				} else if (context.type === "second_factor") {
					setState({ status: "second_factor", context });
				} else {
					setState({ status: "consent", context });
				}
			})
			.catch(onError);
	}, [basePath, challenge, onError, onRedirect]);

	switch (state.status) {
		case "loading":
		case "redirecting":
			return (
				<AuthStatus>
					<Spinner className="size-6" />
					{state.status === "loading" ? t("loading") : t("redirecting")}
				</AuthStatus>
			);
		case "error":
			return <AuthRequestError code={state.code} />;
		case "sign_in":
			return <SignInPrompt context={state.context} basePath={basePath} onRedirect={onRedirect} onError={onError} />;
		case "second_factor":
			return <StepUpPrompt context={state.context} basePath={basePath} onRedirect={onRedirect} onError={onError} />;
		case "consent":
			return <ConsentPrompt context={state.context} basePath={basePath} onRedirect={onRedirect} onError={onError} />;
	}
}

function useCancel(basePath: string, onRedirect: PromptProps<unknown>["onRedirect"], onError: PromptProps<unknown>["onError"]) {
	const [cancelling, setCancelling] = useState(false);

	const cancel = useCallback(async () => {
		setCancelling(true);
		try {
			onRedirect(await api.post<AuthRequestRedirect>(`${basePath}/cancel`));
		} catch (error) {
			onError(error);
		}
	}, [basePath, onError, onRedirect]);

	return { cancelling, cancel };
}

function SignInPrompt({ context, basePath, onRedirect, onError }: PromptProps<AuthRequestSignInPrompt>) {
	const t = useTranslations("authRequest");
	const errorMessage = useErrorMessage();
	const { errors, validate, applyApiError } = useFormErrors();
	const { cancelling, cancel } = useCancel(basePath, onRedirect, onError);
	const [values, setValues] = useState({ email: context.emailHint ?? "", password: "" });
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
			const result = await api.post<AuthRequestSignInResponse>(`${basePath}/sign-in`, input);
			if (result.type === "second_factor") {
				setSubmitting(false);
				setSecondFactor(result);
				return;
			}
			onRedirect(result);
		} catch (error) {
			setSubmitting(false);
			if (applyApiError(error)) {
				return;
			}
			if (error instanceof ApiRequestError && error.code.startsWith("auth_request_")) {
				onError(error);
				return;
			}
			setFormError(
				error instanceof ApiRequestError && error.code === "application_access_denied"
					? t("signIn.accessDenied", { client: context.client.name })
					: errorMessage(error),
			);
			setValues((current) => ({ ...current, password: "" }));
		}
	}

	const busy = submitting || cancelling;
	const redirectNotice = context.client.redirectOrigin
		? t("signIn.redirectNotice", { origin: context.client.redirectOrigin })
		: undefined;

	if (secondFactor) {
		return (
			<SecondFactorStep
				prompt={secondFactor}
				brandName={context.instanceName}
				footer={redirectNotice}
				onSubmit={(code) => submitSecondFactor(basePath, code, onRedirect, onError)}
				onRestart={(message) => {
					setSecondFactor(null);
					setValues((current) => ({ ...current, password: "" }));
					setFormError(message ?? null);
				}}
				secondaryAction={<CancelButton cancelling={cancelling} onCancel={cancel} />}
			/>
		);
	}

	return (
		<AuthCard
			brandName={context.instanceName}
			media={<AppAvatar name={context.client.name} src={context.client.logoUrl} size="lg" />}
			title={t("signIn.title")}
			description={t.rich("signIn.description", {
				client: context.client.name,
				strong: (chunks) => <strong className="font-medium text-foreground">{chunks}</strong>,
			})}
			footer={redirectNotice}
		>
			<form onSubmit={onSubmit} noValidate>
				<FieldGroup>
					{context.deniedAccount ? (
						<Alert>
							<ShieldAlert />
							<AlertTitle>{t("signIn.deniedTitle")}</AlertTitle>
							<AlertDescription>
								{t.rich("signIn.deniedDescription", {
									account: context.deniedAccount.email,
									client: context.client.name,
									strong: (chunks) => <strong className="font-medium text-foreground">{chunks}</strong>,
								})}
							</AlertDescription>
						</Alert>
					) : null}

					{context.reauthenticationRequired ? (
						<Alert>
							<Info />
							<AlertTitle>{t("signIn.reauthenticationTitle")}</AlertTitle>
							<AlertDescription>{t("signIn.reauthenticationDescription")}</AlertDescription>
						</Alert>
					) : null}

					{formError ? (
						<Alert variant="destructive">
							<CircleAlert />
							<AlertTitle>{formError}</AlertTitle>
						</Alert>
					) : null}

					<FormField id="email" label={t("signIn.email")} error={errors.email}>
						<Input
							id="email"
							type="email"
							autoComplete="username"
							placeholder={t("signIn.emailPlaceholder")}
							autoFocus={!values.email}
							value={values.email}
							onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
							aria-invalid={errors.email ? true : undefined}
						/>
					</FormField>

					<FormField id="password" label={t("signIn.password")} error={errors.password}>
						<PasswordInput
							id="password"
							autoComplete="current-password"
							autoFocus={Boolean(values.email)}
							value={values.password}
							onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
							aria-invalid={errors.password ? true : undefined}
						/>
					</FormField>

					{context.passwordResetEnabled ? <ForgotPasswordLink challenge={context.challenge} /> : null}

					<div className="flex flex-col gap-2">
						<Button type="submit" size="lg" className="w-full" disabled={busy}>
							{submitting ? <Spinner /> : null}
							{t("signIn.submit")}
						</Button>
						<Button
							type="button"
							variant="ghost"
							className="w-full text-muted-foreground"
							disabled={busy}
							onClick={() => void cancel()}
						>
							{cancelling ? <Spinner /> : null}
							{t("cancel")}
						</Button>
					</div>

					<AccessDisclosure scopes={context.scopes} />
				</FieldGroup>
			</form>
		</AuthCard>
	);
}

/** Continues the authorization request once the code is confirmed; an ended request shows its error page. */
async function submitSecondFactor(
	basePath: string,
	code: string,
	onRedirect: PromptProps<unknown>["onRedirect"],
	onError: PromptProps<unknown>["onError"],
): Promise<void> {
	try {
		onRedirect(await api.post<AuthRequestRedirect>(`${basePath}/second-factor`, { code }));
	} catch (error) {
		if (error instanceof ApiRequestError && error.code.startsWith("auth_request_")) {
			onError(error);
			return;
		}
		throw error;
	}
}

function CancelButton({ cancelling, onCancel }: { cancelling: boolean; onCancel: () => Promise<void> }) {
	const t = useTranslations("authRequest");

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className="text-muted-foreground"
			disabled={cancelling}
			onClick={() => void onCancel()}
		>
			{cancelling ? <Spinner /> : null}
			{t("cancel")}
		</Button>
	);
}

/**
 * Already signed in with the password, but the application asks for a second factor
 * (`acr_values`): confirming the code is enough.
 */
function StepUpPrompt({ context, basePath, onRedirect, onError }: PromptProps<AuthRequestSecondFactorPrompt>) {
	const t = useTranslations("authRequest");
	const { cancelling, cancel } = useCancel(basePath, onRedirect, onError);

	return (
		<SecondFactorStep
			prompt={context}
			brandName={context.instanceName}
			footer={context.client.redirectOrigin ? t("signIn.redirectNotice", { origin: context.client.redirectOrigin }) : undefined}
			onSubmit={(code) => submitSecondFactor(basePath, code, onRedirect, onError)}
			onRestart={() => window.location.reload()}
			canSwitchAccount={false}
			secondaryAction={<CancelButton cancelling={cancelling} onCancel={cancel} />}
		/>
	);
}

/** Application logo and Aegis mark, connected – the familiar "app ↔ provider" consent visual. */
function ConnectionVisual({ client }: { client: AuthRequestClient }) {
	return (
		<div className="flex items-center gap-2" aria-hidden="true">
			<AppAvatar name={client.name} src={client.logoUrl} size="lg" />
			<span className="w-6 border-t-2 border-dotted border-border" />
			<span className="flex size-7 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-xs">
				<ArrowLeftRight className="size-3.5" />
			</span>
			<span className="w-6 border-t-2 border-dotted border-border" />
			<BrandMark size="lg" />
		</div>
	);
}

function ConsentPrompt({ context, basePath, onRedirect, onError }: PromptProps<AuthRequestConsentPrompt>) {
	const t = useTranslations("authRequest");
	const { cancelling, cancel } = useCancel(basePath, onRedirect, onError);
	const [submitting, setSubmitting] = useState(false);

	async function allow() {
		setSubmitting(true);
		try {
			onRedirect(await api.post<AuthRequestRedirect>(`${basePath}/consent`));
		} catch (error) {
			onError(error);
		}
	}

	const busy = submitting || cancelling;

	return (
		<AuthCard
			brandName={context.instanceName}
			media={<ConnectionVisual client={context.client} />}
			title={t.rich("consent.title", {
				client: context.client.name,
				strong: (chunks) => <span className="text-primary">{chunks}</span>,
			})}
			description={context.client.description || undefined}
			footer={context.client.redirectOrigin ? t("consent.redirectNotice", { origin: context.client.redirectOrigin }) : undefined}
		>
			<div className="flex flex-col gap-5 text-left">
				<div className="flex items-center gap-3 rounded-xl border bg-muted/40 px-3 py-2.5">
					<UserAvatar name={context.account.displayName} src={context.account.avatarUrl} />
					<div className="min-w-0 flex-1 text-sm leading-tight">
						<p className="truncate font-medium">{context.account.displayName}</p>
						<p className="truncate text-xs text-muted-foreground">{context.account.email}</p>
					</div>
					<span className="shrink-0 text-xs text-muted-foreground">{t("consent.signedInAs")}</span>
				</div>

				<div className="flex flex-col gap-2.5">
					<p className="text-sm font-medium">{t("consent.scopesHeading")}</p>
					<ScopeList scopes={context.scopes} className="overflow-hidden rounded-xl border" />
					<p className="text-xs text-muted-foreground">{t("consent.revokeNotice")}</p>
				</div>

				<div className="grid grid-cols-2 gap-2">
					<Button variant="outline" size="lg" disabled={busy} onClick={() => void cancel()}>
						{cancelling ? <Spinner /> : null}
						{t("consent.deny")}
					</Button>
					<Button size="lg" disabled={busy} onClick={() => void allow()}>
						{submitting ? <Spinner /> : null}
						{t("consent.allow")}
					</Button>
				</div>
			</div>
		</AuthCard>
	);
}

function AuthRequestError({ code }: { code: string }) {
	const t = useTranslations("authRequest");
	const errorMessage = useErrorMessage();

	if (code === "missing") {
		return <AuthCard icon={<SearchX />} title={t("missing.title")} description={t("missing.description")} />;
	}

	const expired = code === "auth_request_expired" || code === "auth_request_invalid";

	return (
		<AuthCard
			icon={expired ? <Clock /> : <CircleAlert />}
			title={expired ? t("expired.title") : t("failed.title")}
			description={expired ? t("expired.description") : errorMessage(new ApiRequestError(0, code as ApiRequestError["code"], code))}
			footer={t("returnNotice")}
		/>
	);
}
