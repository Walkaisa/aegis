"use client";

import {
	AUDIT_RETENTION_DAYS_MAX,
	AUDIT_RETENTION_DAYS_MIN,
	type InstanceSettingsDto,
	instanceSettingsSchema,
	SESSION_TTL_DAYS_MAX,
	SESSION_TTL_DAYS_MIN,
} from "@aegis/contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { CopyField } from "@/components/copy-button";
import { useAccount } from "@/components/dashboard/account-context";
import { Section } from "@/components/dashboard/page";
import { ErrorState, LoadingState } from "@/components/dashboard/states";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { useApiQuery } from "@/hooks/use-api-query";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormErrors } from "@/hooks/use-form-errors";
import { api } from "@/lib/api";

export function GeneralSettings() {
	const t = useTranslations("settings");
	const { me, update } = useAccount();
	const { data, error, reload, setData } = useApiQuery<InstanceSettingsDto>("/settings");

	return (
		<Section title={t("instance")} description={t("instanceDescription")}>
			{error ? (
				<ErrorState error={error} onRetry={() => void reload()} />
			) : !data ? (
				<LoadingState rows={3} className="h-14" />
			) : (
				<InstanceForm
					key={`${data.instanceName}-${data.sessionTtlDays}-${data.auditRetentionDays}`}
					settings={data}
					onSaved={(settings) => {
						setData(settings);
						update({ ...me, instanceName: settings.instanceName });
					}}
				/>
			)}
		</Section>
	);
}

function InstanceForm({ settings, onSaved }: { settings: InstanceSettingsDto; onSaved: (settings: InstanceSettingsDto) => void }) {
	const t = useTranslations("settings");
	const errorMessage = useErrorMessage();
	const { errors, validate, applyApiError } = useFormErrors();
	const [instanceName, setInstanceName] = useState(settings.instanceName);
	const [sessionTtlDays, setSessionTtlDays] = useState(String(settings.sessionTtlDays));
	const [auditRetentionDays, setAuditRetentionDays] = useState(String(settings.auditRetentionDays));
	const [submitting, setSubmitting] = useState(false);

	const asNumber = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const input = validate(instanceSettingsSchema, {
			instanceName,
			sessionTtlDays: asNumber(sessionTtlDays),
			auditRetentionDays: asNumber(auditRetentionDays),
		});
		if (!input) {
			return;
		}

		setSubmitting(true);
		try {
			onSaved(await api.patch<InstanceSettingsDto>("/settings", input));
			toast.success(t("instanceSaved"));
		} catch (error) {
			if (!applyApiError(error)) {
				toast.error(errorMessage(error));
			}
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<form onSubmit={onSubmit} noValidate className="max-w-md">
			<FieldGroup>
				<FormField
					id="instance-name"
					label={t("instanceName")}
					description={t("instanceNameDescription")}
					error={errors.instanceName}
				>
					<Input
						id="instance-name"
						value={instanceName}
						onChange={(event) => setInstanceName(event.target.value)}
						aria-invalid={errors.instanceName ? true : undefined}
					/>
				</FormField>
				<FormField
					id="instance-session-ttl"
					label={t("sessionTtl")}
					description={t("sessionTtlDescription", { min: SESSION_TTL_DAYS_MIN, max: SESSION_TTL_DAYS_MAX })}
					error={errors.sessionTtlDays}
				>
					<InputGroup className="w-40">
						<InputGroupInput
							id="instance-session-ttl"
							type="number"
							inputMode="numeric"
							step={1}
							min={SESSION_TTL_DAYS_MIN}
							max={SESSION_TTL_DAYS_MAX}
							value={sessionTtlDays}
							onChange={(event) => setSessionTtlDays(event.target.value)}
							aria-invalid={errors.sessionTtlDays ? true : undefined}
						/>
						<InputGroupAddon align="inline-end">
							<InputGroupText>{t("days")}</InputGroupText>
						</InputGroupAddon>
					</InputGroup>
				</FormField>
				<FormField
					id="instance-audit-retention"
					label={t("auditRetention")}
					description={t("auditRetentionDescription", { min: AUDIT_RETENTION_DAYS_MIN, max: AUDIT_RETENTION_DAYS_MAX })}
					error={errors.auditRetentionDays}
				>
					<InputGroup className="w-40">
						<InputGroupInput
							id="instance-audit-retention"
							type="number"
							inputMode="numeric"
							step={1}
							min={AUDIT_RETENTION_DAYS_MIN}
							max={AUDIT_RETENTION_DAYS_MAX}
							value={auditRetentionDays}
							onChange={(event) => setAuditRetentionDays(event.target.value)}
							aria-invalid={errors.auditRetentionDays ? true : undefined}
						/>
						<InputGroupAddon align="inline-end">
							<InputGroupText>{t("days")}</InputGroupText>
						</InputGroupAddon>
					</InputGroup>
				</FormField>
				<Field>
					<FieldLabel htmlFor="instance-issuer">{t("issuer")}</FieldLabel>
					<CopyField id="instance-issuer" value={settings.issuer} />
					<FieldDescription>{t("issuerDescription")}</FieldDescription>
				</Field>
				<Button type="submit" className="w-fit" disabled={submitting}>
					{submitting ? <Spinner /> : null}
					{t("save")}
				</Button>
			</FieldGroup>
		</form>
	);
}
