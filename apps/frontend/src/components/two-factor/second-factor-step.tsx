"use client";

import type { SecondFactorPrompt } from "@aegis/contracts";
import { KeyRound, LifeBuoy, ShieldCheck, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, type ReactNode, useCallback, useRef, useState } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { IconInput } from "@/components/icon-input";
import { StatusMessage } from "@/components/status-message";
import { OneTimeCodeInput } from "@/components/two-factor/one-time-code-input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { UserAvatar } from "@/components/users/account-badges";
import { useErrorMessage } from "@/hooks/use-error-message";
import { ApiRequestError } from "@/lib/api";

type Method = "totp" | "recovery_code";

/**
 * The second step of a sign-in for accounts with two-factor authentication: a code from the
 * authenticator app, or a recovery code as fallback. A code is submitted as soon as it is complete.
 */
export function SecondFactorStep({
	prompt,
	brandName,
	onSubmit,
	onRestart,
	secondaryAction,
	footer,
	canSwitchAccount = true,
}: {
	prompt: SecondFactorPrompt;
	brandName?: string;
	/** Confirms the code; errors are shown in the form. */
	onSubmit: (code: string) => Promise<void>;
	/** Back to the password, e.g. for another account or after the sign-in expired. */
	onRestart?: (message?: string) => void;
	/** Below the method switch, e.g. cancelling an authorization request. */
	secondaryAction?: ReactNode;
	footer?: ReactNode;
	/** Offers going back to the password with another account. */
	canSwitchAccount?: boolean;
}) {
	const t = useTranslations("twoFactor.signIn");
	const errorMessage = useErrorMessage();
	const [method, setMethod] = useState<Method>("totp");
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const submit = useCallback(
		async (value: string) => {
			if (submitting || value.trim().length === 0) {
				return;
			}
			setError(null);
			setSubmitting(true);
			try {
				await onSubmit(value);
				// On success the page navigates away; keep the spinner until it does.
			} catch (caught) {
				setSubmitting(false);
				setCode("");
				if (caught instanceof ApiRequestError && caught.code === "second_factor_expired" && onRestart) {
					onRestart(t("expired"));
					return;
				}
				setError(
					caught instanceof ApiRequestError && (caught.code === "second_factor_invalid" || caught.code === "validation_failed")
						? method === "totp"
							? t("invalidCode")
							: t("invalidRecoveryCode")
						: errorMessage(caught),
				);
				requestAnimationFrame(() => inputRef.current?.focus());
			}
		},
		[errorMessage, method, onRestart, onSubmit, submitting, t],
	);

	function onFormSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		void submit(code);
	}

	function switchMethod(next: Method) {
		setMethod(next);
		setCode("");
		setError(null);
		requestAnimationFrame(() => inputRef.current?.focus());
	}

	const onTotp = method === "totp";

	return (
		<AuthCard
			brandName={brandName}
			media={
				<div className="relative">
					<UserAvatar name={prompt.account.displayName} src={prompt.account.avatarUrl} size="lg" />
					<span className="absolute -right-1.5 -bottom-1.5 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-card">
						<ShieldCheck className="size-3.5" />
					</span>
				</div>
			}
			title={t("title")}
			description={onTotp ? t("totpDescription") : t("recoveryDescription")}
			footer={footer}
		>
			<form onSubmit={onFormSubmit} noValidate className="flex flex-col gap-5">
				<div className="-mt-1 flex items-center justify-center gap-2 text-sm">
					<span className="truncate text-muted-foreground">{prompt.account.email}</span>
					{onRestart && canSwitchAccount ? (
						<button
							type="button"
							onClick={() => onRestart()}
							className="shrink-0 rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
						>
							{t("notYou")}
						</button>
					) : null}
				</div>

				{error ? <StatusMessage tone="error" title={error} /> : null}

				<div key={method} className="animate-in duration-200 fade-in-0 motion-reduce:animate-none">
					{onTotp ? (
						<OneTimeCodeInput
							ref={inputRef}
							id="second-factor-code"
							aria-label={t("codeLabel")}
							className="mx-auto"
							value={code}
							onChange={(value) => {
								setCode(value);
								setError(null);
							}}
							onComplete={(value) => void submit(value)}
							aria-invalid={error ? true : undefined}
							disabled={submitting}
							autoFocus
						/>
					) : (
						<IconInput
							ref={inputRef}
							id="second-factor-code"
							aria-label={t("recoveryLabel")}
							icon={<KeyRound />}
							placeholder="XXXXX-XXXXX"
							autoComplete="off"
							autoCapitalize="characters"
							spellCheck={false}
							className="h-10 [&_input]:font-mono [&_input]:tracking-wider"
							value={code}
							onChange={(event) => {
								setCode(event.target.value);
								setError(null);
							}}
							aria-invalid={error ? true : undefined}
							disabled={submitting}
							autoFocus
						/>
					)}
				</div>

				<Button type="submit" size="lg" className="h-10 w-full text-sm" disabled={submitting || code.trim().length === 0}>
					{submitting ? <Spinner /> : null}
					{t("submit")}
				</Button>

				<div className="flex flex-col items-center gap-3 border-t pt-4 text-sm">
					<button
						type="button"
						onClick={() => switchMethod(onTotp ? "recovery_code" : "totp")}
						disabled={submitting}
						className="inline-flex items-center gap-2 rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
					>
						{onTotp ? <LifeBuoy className="size-4" /> : <Smartphone className="size-4" />}
						{onTotp ? t("useRecoveryCode") : t("useAuthenticator")}
					</button>
					{secondaryAction}
				</div>
			</form>
		</AuthCard>
	);
}
