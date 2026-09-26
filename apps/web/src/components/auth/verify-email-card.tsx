"use client";

import { type EmailChangeConfirmResponse, type InstanceInfo, verificationLinkSchema } from "@aegis/contracts";
import { MailCheck, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { AuthCard, AuthStatus } from "@/components/auth/auth-card";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useApiQuery } from "@/hooks/use-api-query";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useLinkToken } from "@/hooks/use-link-token";
import { ApiRequestError, api } from "@/lib/api";

type State =
	| { status: "pending" }
	| { status: "confirmed"; email: string }
	| { status: "invalid"; error: ApiRequestError | null }
	| { status: "failed"; error: unknown };

/** Errors after which this link can never succeed; anything else may work on another try. */
const FINAL_ERRORS = new Set(["verification_token_invalid", "validation_failed", "email_taken"]);

/**
 * Confirms a new e-mail address from the link that was sent to it. The link carries the only proof
 * needed, so this works in a browser that has never signed in — which is exactly where a fresh
 * mailbox tends to be opened.
 */
export function VerifyEmailCard() {
	const t = useTranslations("verifyEmail");
	const tCommon = useTranslations("common");
	const errorMessage = useErrorMessage();
	const { data: instance } = useApiQuery<InstanceInfo>("/instance");
	const token = useLinkToken();
	const [state, setState] = useState<State>({ status: "pending" });
	// React runs effects twice in development; the token may only be redeemed once.
	const started = useRef(false);

	useEffect(() => {
		if (started.current || !token) {
			return;
		}
		started.current = true;

		const input = verificationLinkSchema.safeParse({ token });
		if (!input.success) {
			setState({ status: "invalid", error: null });
			return;
		}

		api.post<EmailChangeConfirmResponse>("/auth/email-change/confirm", input.data).then(
			(result) => setState({ status: "confirmed", email: result.email }),
			(error: unknown) =>
				setState(
					error instanceof ApiRequestError && FINAL_ERRORS.has(error.code)
						? { status: "invalid", error }
						: { status: "failed", error },
				),
		);
	}, [token]);

	const instanceName = instance?.instanceName ?? "Aegis";
	const footer = (
		<span className="inline-flex items-start gap-2 text-left">
			<ShieldCheck aria-hidden="true" className="mt-px size-3.5 shrink-0" />
			{t("footer")}
		</span>
	);
	const signIn = (
		<Button asChild size="lg" className="h-10 w-full text-sm">
			<Link href="/sign-in">{t("signIn")}</Link>
		</Button>
	);

	if (token === null) {
		return (
			<AuthCard
				brandName={instanceName}
				icon={<TriangleAlert />}
				title={t("missingTitle")}
				description={t("missingDescription")}
				footer={footer}
			>
				{signIn}
			</AuthCard>
		);
	}

	if (state.status === "pending") {
		return (
			<AuthCard brandName={instanceName} title={t("title")}>
				<AuthStatus>
					<Spinner />
					{t("checking")}
				</AuthStatus>
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
				<div className="flex flex-col gap-5">
					{state.error?.code === "email_taken" ? <StatusMessage tone="error" title={errorMessage(state.error)} /> : null}
					{signIn}
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

	return (
		<AuthCard brandName={instanceName} icon={<MailCheck />} title={t("successTitle")}>
			<div className="flex flex-col gap-5">
				<StatusMessage tone="success" title={t("successDescription", { email: state.email })} />
				{signIn}
			</div>
		</AuthCard>
	);
}
