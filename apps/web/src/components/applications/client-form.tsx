"use client";

import {
	CLIENT_AUTH_METHODS,
	type ClientAccessPolicy,
	type ClientAuthMethod,
	type ClientDto,
	type ClientType,
	clientUpdateSchemaFor,
	MAX_REDIRECT_URIS,
	PKCE_POLICIES_BY_TYPE,
	type PkcePolicy,
	type SupportedScope,
} from "@aegis/contracts";
import { Lock, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { ScopeSelector } from "@/components/applications/scope-selector";
import { Section } from "@/components/dashboard/page";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSeparator,
	FieldSet,
	FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useErrorMessage } from "@/hooks/use-error-message";
import { type FieldErrors, useFormErrors } from "@/hooks/use-form-errors";
import { applicationKindOf, KIND_ICONS } from "@/lib/applications";

export interface ClientFormValues {
	name: string;
	description: string;
	tokenEndpointAuthMethod: ClientAuthMethod;
	redirectUris: string[];
	postLogoutRedirectUris: string[];
	allowedScopes: SupportedScope[];
	skipConsent: boolean;
	pkcePolicy: PkcePolicy;
	enabled: boolean;
	/** Edited on the access tab; carried along because saving replaces all settings. */
	accessPolicy: ClientAccessPolicy;
}

/** The editable settings of an application, as `PUT /api/applications/:id` replaces them. */
export function clientValuesOf(client: ClientDto): ClientFormValues {
	return {
		name: client.name,
		description: client.description,
		tokenEndpointAuthMethod: client.tokenEndpointAuthMethod === "none" ? "client_secret_basic" : client.tokenEndpointAuthMethod,
		redirectUris: client.redirectUris,
		postLogoutRedirectUris: client.postLogoutRedirectUris,
		allowedScopes: client.allowedScopes,
		skipConsent: client.skipConsent,
		pkcePolicy: client.pkcePolicy,
		enabled: client.enabled,
		accessPolicy: client.accessPolicy,
	};
}

interface UriRow {
	id: number;
	value: string;
}

let nextRowId = 0;
const toRows = (values: string[]): UriRow[] =>
	values.map((value) => {
		nextRowId += 1;
		return { id: nextRowId, value };
	});

/** Settings of an existing application, saved through a floating bar once something changed. */
export function ClientForm({ client, onSubmit }: { client: ClientDto; onSubmit: (values: ClientFormValues) => Promise<void> }) {
	const t = useTranslations("clientForm");
	const tKinds = useTranslations("applicationKinds");
	const errorMessage = useErrorMessage();
	const { errors, validate, applyApiError, clear } = useFormErrors();
	const initial = useMemo(() => clientValuesOf(client), [client]);
	const [values, setValues] = useState(initial);
	const [redirectRows, setRedirectRows] = useState(() => toRows(initial.redirectUris.length > 0 ? initial.redirectUris : [""]));
	const [signOutRows, setSignOutRows] = useState(() => toRows(initial.postLogoutRedirectUris));
	const [submitting, setSubmitting] = useState(false);

	const kind = applicationKindOf(client);
	const KindIcon = KIND_ICONS[kind];
	const candidate: ClientFormValues = {
		...values,
		redirectUris: redirectRows.map((row) => row.value.trim()),
		postLogoutRedirectUris: signOutRows.map((row) => row.value.trim()),
	};
	const dirty = JSON.stringify(candidate) !== JSON.stringify(initial);

	const set = <K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) =>
		setValues((current) => ({ ...current, [key]: value }));

	function reset() {
		setValues(initial);
		setRedirectRows(toRows(initial.redirectUris));
		setSignOutRows(toRows(initial.postLogoutRedirectUris));
		clear();
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!validate(clientUpdateSchemaFor(client.type), candidate)) {
			toast.error(t("fixErrors"));
			return;
		}

		setSubmitting(true);
		try {
			await onSubmit(candidate);
		} catch (error) {
			if (!applyApiError(error)) {
				toast.error(errorMessage(error));
			}
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
			<Section title={t("general")} description={t("generalDescription")}>
				<FieldGroup>
					<FormField id="client-name" label={t("name")} error={errors.name}>
						<Input
							id="client-name"
							value={values.name}
							placeholder={t("namePlaceholder")}
							onChange={(event) => set("name", event.target.value)}
							aria-invalid={errors.name ? true : undefined}
						/>
					</FormField>
					<FormField
						id="client-description"
						label={t("description")}
						description={t("descriptionHint")}
						error={errors.description}
					>
						<Textarea
							id="client-description"
							rows={2}
							value={values.description}
							placeholder={t("descriptionPlaceholder")}
							onChange={(event) => set("description", event.target.value)}
							aria-invalid={errors.description ? true : undefined}
						/>
					</FormField>
				</FieldGroup>
			</Section>

			<Section title={t("urls")} description={t("urlsDescription")}>
				<FieldGroup>
					<UriListField
						field="redirectUris"
						label={t("redirectUris")}
						description={t("redirectUrisDescription")}
						rows={redirectRows}
						onChange={setRedirectRows}
						errors={errors}
						minimum={1}
					/>
					<FieldSeparator />
					<UriListField
						field="postLogoutRedirectUris"
						label={t("postSignOutRedirectUris")}
						description={t("postSignOutRedirectUrisDescription")}
						rows={signOutRows}
						onChange={setSignOutRows}
						errors={errors}
						minimum={0}
					/>
				</FieldGroup>
			</Section>

			<Section title={t("scopes")} description={t("scopesDescription")}>
				<Field data-invalid={errors.allowedScopes ? true : undefined}>
					<ScopeSelector value={values.allowedScopes} onChange={(scopes) => set("allowedScopes", scopes)} idPrefix="client" />
					<FieldError>{errors.allowedScopes}</FieldError>
				</Field>
			</Section>

			<Section title={t("security")} description={t("securityDescription")}>
				<FieldGroup>
					<Field>
						<FieldTitle>{t("clientType")}</FieldTitle>
						<div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
							<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
								<KindIcon className="size-4" />
							</span>
							<div className="min-w-0 text-sm">
								<p className="font-medium">
									{tKinds(`${kind}.title`)} · {t(`clientTypes.${client.type}`)}
								</p>
								<p className="text-xs text-muted-foreground">{t("typeLocked")}</p>
							</div>
							<Lock className="ml-auto size-4 shrink-0 text-muted-foreground" />
						</div>
					</Field>

					{client.type === "confidential" ? (
						<FormField
							id="client-auth-method"
							label={t("authMethod")}
							description={t("authMethodDescription")}
							error={errors.tokenEndpointAuthMethod}
						>
							<Select
								value={values.tokenEndpointAuthMethod}
								onValueChange={(value) => set("tokenEndpointAuthMethod", value as ClientAuthMethod)}
							>
								<SelectTrigger id="client-auth-method" className="w-full sm:w-80">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{CLIENT_AUTH_METHODS.map((method) => (
										<SelectItem key={method} value={method}>
											{t(`authMethods.${method}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FormField>
					) : null}

					<PkcePolicyField
						id="client-pkce-policy"
						type={client.type}
						value={values.pkcePolicy}
						onChange={(policy) => set("pkcePolicy", policy)}
						error={errors.pkcePolicy}
					/>

					<FieldSeparator />

					<Field orientation="horizontal">
						<FieldContent>
							<FieldLabel htmlFor="client-skip-consent">{t("skipConsent")}</FieldLabel>
							<FieldDescription>{t("skipConsentDescription")}</FieldDescription>
						</FieldContent>
						<Switch
							id="client-skip-consent"
							checked={values.skipConsent}
							onCheckedChange={(checked) => set("skipConsent", checked)}
						/>
					</Field>
				</FieldGroup>
			</Section>

			<Section title={t("status")}>
				<Field orientation="horizontal">
					<FieldContent>
						<FieldLabel htmlFor="client-enabled">{t("enabled")}</FieldLabel>
						<FieldDescription>{t("enabledDescription")}</FieldDescription>
					</FieldContent>
					<Switch id="client-enabled" checked={values.enabled} onCheckedChange={(checked) => set("enabled", checked)} />
				</Field>
			</Section>

			{dirty ? (
				<div className="sticky bottom-4 z-10 flex animate-in flex-col gap-3 rounded-xl border bg-card/95 p-3 pl-4 shadow-lg backdrop-blur fade-in slide-in-from-bottom-2 sm:flex-row sm:items-center sm:justify-between">
					<span className="text-sm font-medium">{t("unsavedChanges")}</span>
					<div className="flex gap-2 sm:justify-end">
						<Button type="button" variant="ghost" disabled={submitting} onClick={reset}>
							{t("discard")}
						</Button>
						<Button type="submit" disabled={submitting}>
							{submitting ? <Spinner /> : null}
							{t("save")}
						</Button>
					</div>
				</div>
			) : null}
		</form>
	);
}

/**
 * Whether the application must use PKCE. Public clients have no secret, so PKCE is their only
 * protection of the code exchange and the select offers nothing but "required".
 */
export function PkcePolicyField({
	id,
	type,
	value,
	onChange,
	error,
}: {
	id: string;
	type: ClientType;
	value: PkcePolicy;
	onChange: (policy: PkcePolicy) => void;
	error?: string;
}) {
	const t = useTranslations("clientForm");
	const policies = PKCE_POLICIES_BY_TYPE[type];
	const locked = policies.length === 1;

	return (
		<FormField
			id={id}
			label={t("pkce")}
			description={
				<>
					{t(`pkcePolicyDescriptions.${value}`)}
					{locked ? ` ${t("pkcePublicLocked")}` : null}
				</>
			}
			error={error}
		>
			<Select value={value} onValueChange={(next) => onChange(next as PkcePolicy)} disabled={locked}>
				<SelectTrigger id={id} className="w-full sm:w-80" aria-invalid={error ? true : undefined}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{policies.map((policy) => (
						<SelectItem key={policy} value={policy}>
							{t(`pkcePolicies.${policy}`)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</FormField>
	);
}

function UriListField({
	field,
	label,
	description,
	rows,
	onChange,
	errors,
	minimum,
}: {
	field: "redirectUris" | "postLogoutRedirectUris";
	label: string;
	description: string;
	rows: UriRow[];
	onChange: (rows: UriRow[]) => void;
	errors: FieldErrors;
	minimum: number;
}) {
	const t = useTranslations("clientForm");

	return (
		<FieldSet>
			<FieldLegend variant="label">{label}</FieldLegend>
			<FieldDescription>{description}</FieldDescription>

			{rows.length > 0 ? (
				<div className="flex flex-col gap-2">
					{rows.map((row, index) => {
						const error = errors[`${field}.${index}`];
						return (
							<Field key={row.id} data-invalid={error ? true : undefined}>
								<div className="flex items-center gap-2">
									<Input
										value={row.value}
										placeholder={t("uriPlaceholder")}
										aria-label={t("uriLabel", { field: label, index: index + 1 })}
										aria-invalid={error ? true : undefined}
										className="font-mono text-[13px]"
										type="url"
										inputMode="url"
										autoCapitalize="none"
										autoCorrect="off"
										spellCheck={false}
										onChange={(event) =>
											onChange(
												rows.map((entry) =>
													entry.id === row.id ? { ...entry, value: event.target.value } : entry,
												),
											)
										}
									/>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										aria-label={t("removeUri")}
										disabled={rows.length <= minimum}
										onClick={() => onChange(rows.filter((entry) => entry.id !== row.id))}
									>
										<X />
									</Button>
								</div>
								<FieldError>{error}</FieldError>
							</Field>
						);
					})}
				</div>
			) : null}

			<FieldError>{errors[field]}</FieldError>

			<Button
				type="button"
				variant="outline"
				size="sm"
				className="w-fit"
				disabled={rows.length >= MAX_REDIRECT_URIS}
				onClick={() => onChange([...rows, ...toRows([""])])}
			>
				<Plus />
				{t("addUri")}
			</Button>
		</FieldSet>
	);
}
