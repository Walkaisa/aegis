"use client";

import type { ClientWithSecretResponse } from "@aegis/contracts";
import { CircleCheck, CircleSlash, History, KeyRound, MonitorSmartphone, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApplication } from "@/components/applications/application-layout";
import { SecretDialog } from "@/components/applications/secret-dialog";
import { CodeBlock } from "@/components/code-block";
import { CopyField } from "@/components/copy-button";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DetailRow, DetailsCard, FactGrid, Section } from "@/components/dashboard/page";
import { LoadingState } from "@/components/dashboard/states";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useJsonQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api";
import { applicationKindOf, buildSnippets, type IntegrationId, integrationsFor, SECRET_PLACEHOLDER } from "@/lib/applications";
import { useDateFormat } from "@/lib/format";

interface DiscoveryDocument {
	issuer: string;
	authorization_endpoint: string;
	token_endpoint: string;
	userinfo_endpoint: string;
	jwks_uri: string;
	end_session_endpoint?: string;
	revocation_endpoint?: string;
}

export function ApplicationQuickstart() {
	const t = useTranslations("quickstart");
	const tClientForm = useTranslations("clientForm");
	const tKinds = useTranslations("applicationKinds");
	const dates = useDateFormat();
	const { client, path, setClient } = useApplication();
	const discovery = useJsonQuery<DiscoveryDocument>("/.well-known/openid-configuration");
	const kind = applicationKindOf(client);
	const integrations = integrationsFor(kind);
	const [integrationId, setIntegrationId] = useState<IntegrationId>(integrations[0]?.id ?? "generic");
	const [rotated, setRotated] = useState<string | null>(null);
	const confidential = client.type === "confidential";

	async function rotateSecret() {
		const result = await api.post<ClientWithSecretResponse>(`${path}/secret`);
		setClient(result.client);
		setRotated(result.clientSecret);
		toast.success(t("secretRotated"));
	}

	const document = discovery.data;
	const endpoints = document
		? ([
				["discovery", `${document.issuer}/.well-known/openid-configuration`],
				["authorization", document.authorization_endpoint],
				["token", document.token_endpoint],
				["userinfo", document.userinfo_endpoint],
				["jwks", document.jwks_uri],
				["endSession", document.end_session_endpoint],
				["revocation", document.revocation_endpoint],
			] as const)
		: [];

	return (
		<div className="flex flex-col gap-6">
			<FactGrid
				facts={[
					{
						icon: client.enabled ? <CircleCheck /> : <CircleSlash />,
						label: t("facts.status"),
						value: client.enabled ? t("facts.enabled") : t("facts.disabled"),
						hint: client.enabled ? t("facts.enabledHint") : t("facts.disabledHint"),
					},
					{
						icon: <ShieldCheck />,
						label: t("detailLabels.type"),
						value: tKinds(`${kind}.title`),
						hint: confidential ? t("facts.confidential") : t("facts.public"),
					},
					{
						icon: <MonitorSmartphone />,
						label: t("facts.sessions"),
						value: client.activeSessionCount,
						hint: t("facts.sessionsHint", { count: client.activeSessionCount }),
					},
					{
						icon: <History />,
						label: t("detailLabels.lastUsed"),
						value: client.lastAuthorizedAt ? dates.relative(client.lastAuthorizedAt) : t("neverUsed"),
						hint: client.lastAuthorizedAt ? dates.dateTime(client.lastAuthorizedAt) : undefined,
					},
				]}
			/>
			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
				<div className="flex min-w-0 flex-col gap-6">
					<Section title={t("credentials")} description={t("credentialsDescription")}>
						<FieldGroup className="gap-5">
							<Field>
								<FieldLabel htmlFor="quickstart-issuer">{t("issuer")}</FieldLabel>
								{document ? (
									<CopyField id="quickstart-issuer" value={document.issuer} />
								) : (
									<LoadingState rows={1} className="h-8" />
								)}
							</Field>
							<Field>
								<FieldLabel htmlFor="quickstart-client-id">{t("clientId")}</FieldLabel>
								<CopyField id="quickstart-client-id" value={client.id} />
							</Field>
							{confidential ? (
								<Field>
									<FieldLabel>{t("clientSecret")}</FieldLabel>
									<div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
										<div className="flex min-w-0 items-center gap-3">
											<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border">
												<KeyRound className="size-4" />
											</span>
											<div className="min-w-0 text-sm">
												<p className="font-mono tracking-widest">••••••••••••••••••••</p>
												<p className="text-xs text-muted-foreground">
													{client.secretRotatedAt
														? t("secretRotatedAt", { date: dates.dateTime(client.secretRotatedAt) })
														: t("secretHidden")}
												</p>
											</div>
										</div>
										<ConfirmDialog
											trigger={
												<Button variant="outline" size="sm" className="w-full sm:w-auto">
													{t("rotateSecret")}
												</Button>
											}
											title={t("rotateTitle")}
											description={t("rotateDescription")}
											confirmLabel={t("rotateConfirm")}
											destructive
											onConfirm={rotateSecret}
										/>
									</div>
								</Field>
							) : (
								<p className="text-sm text-muted-foreground">{t("publicClientNotice")}</p>
							)}
						</FieldGroup>
					</Section>

					<Section title={t("integration")} description={t("integrationDescription")}>
						<div className="flex flex-col gap-4">
							<ToggleGroup
								type="single"
								variant="outline"
								size="sm"
								value={integrationId}
								onValueChange={(value) => value && setIntegrationId(value as IntegrationId)}
								className="flex-wrap"
							>
								{integrations.map((integration) => (
									<ToggleGroupItem key={integration.id} value={integration.id}>
										{integration.name ?? t("genericIntegration")}
									</ToggleGroupItem>
								))}
							</ToggleGroup>
							{document ? (
								buildSnippets(integrationId, {
									issuer: document.issuer,
									clientId: client.id,
									clientSecret: confidential ? SECRET_PLACEHOLDER : null,
									redirectUri: client.redirectUris[0] ?? "",
									postSignOutRedirectUri: client.postLogoutRedirectUris[0] ?? null,
									scopes: client.allowedScopes,
								}).map((snippet) => <CodeBlock key={snippet.file} file={snippet.file} code={snippet.code} />)
							) : (
								<LoadingState rows={1} className="h-40" />
							)}
							{confidential ? (
								<p className="text-xs text-muted-foreground">
									{t("secretPlaceholderNotice", { placeholder: SECRET_PLACEHOLDER })}
								</p>
							) : null}
						</div>
					</Section>

					<Section title={t("endpoints")} description={t("endpointsDescription")}>
						{document ? (
							<FieldGroup className="gap-4">
								{endpoints.map(([key, value]) =>
									value ? (
										<Field key={key}>
											<FieldLabel htmlFor={`endpoint-${key}`}>{t(`endpointLabels.${key}`)}</FieldLabel>
											<CopyField id={`endpoint-${key}`} value={value} />
										</Field>
									) : null,
								)}
							</FieldGroup>
						) : (
							<LoadingState rows={4} className="h-12" />
						)}
					</Section>
				</div>

				<aside className="flex flex-col gap-6">
					<DetailsCard title={t("details")}>
						<DetailRow label={t("detailLabels.authentication")}>
							{client.tokenEndpointAuthMethod === "none" ? (
								t("noClientAuthentication")
							) : (
								<code className="font-mono text-xs">{client.tokenEndpointAuthMethod}</code>
							)}
						</DetailRow>
						<DetailRow label={t("detailLabels.grant")}>{t("grantValue")}</DetailRow>
						<DetailRow label={t("detailLabels.pkce")}>{tClientForm(`pkcePolicies.${client.pkcePolicy}`)}</DetailRow>
						<DetailRow label={t("detailLabels.scopes")}>
							<code className="font-mono text-xs">{client.allowedScopes.join(" ")}</code>
						</DetailRow>
						<DetailRow label={t("detailLabels.consent")}>
							{client.skipConsent ? t("consentSkipped") : t("consentRequired")}
						</DetailRow>
						<DetailRow label={t("detailLabels.created")}>{dates.date(client.createdAt)}</DetailRow>
					</DetailsCard>

					<Section
						title={t("urls")}
						action={
							<Button asChild variant="ghost" size="sm">
								<Link href={`/applications/${client.id}/settings`}>{t("edit")}</Link>
							</Button>
						}
					>
						<div className="flex flex-col gap-4 text-sm">
							<UriList label={t("redirectUris")} uris={client.redirectUris} empty={t("none")} />
							<UriList label={t("postSignOutRedirectUris")} uris={client.postLogoutRedirectUris} empty={t("none")} />
						</div>
					</Section>
				</aside>

				{rotated ? <SecretDialog clientId={client.id} clientSecret={rotated} onClose={() => setRotated(null)} /> : null}
			</div>
		</div>
	);
}

function UriList({ label, uris, empty }: { label: string; uris: string[]; empty: string }) {
	return (
		<div className="flex flex-col gap-1.5">
			<p className="text-xs font-medium text-muted-foreground">{label}</p>
			{uris.length === 0 ? (
				<p className="text-muted-foreground">{empty}</p>
			) : (
				<ul className="flex flex-col gap-1">
					{uris.map((uri) => (
						<li key={uri} className="font-mono text-xs break-all">
							{uri}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
