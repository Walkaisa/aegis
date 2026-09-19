"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { CopyField } from "@/components/copy-button";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

/**
 * Shows a client secret exactly once. The dialog can only be closed after confirming that the
 * secret has been stored, because it cannot be displayed again.
 */
export function SecretDialog({ clientId, clientSecret, onClose }: { clientId: string; clientSecret: string; onClose: () => void }) {
	const t = useTranslations("secretDialog");
	const [confirmed, setConfirmed] = useState(false);

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && confirmed) {
					onClose();
				}
			}}
		>
			<DialogContent
				showCloseButton={false}
				className="sm:max-w-lg"
				onEscapeKeyDown={(event) => {
					if (!confirmed) {
						event.preventDefault();
					}
				}}
				onPointerDownOutside={(event) => event.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle>{t("title")}</DialogTitle>
					<DialogDescription>{t("description")}</DialogDescription>
				</DialogHeader>

				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="secret-client-id">{t("clientId")}</FieldLabel>
						<CopyField id="secret-client-id" value={clientId} />
					</Field>
					<Field>
						<FieldLabel htmlFor="secret-client-secret">{t("clientSecret")}</FieldLabel>
						<CopyField id="secret-client-secret" value={clientSecret} />
					</Field>

					<StatusMessage tone="warning" title={t("warningTitle")}>
						{t("warning")}
					</StatusMessage>

					<Field orientation="horizontal">
						<Checkbox id="secret-confirm" checked={confirmed} onCheckedChange={(checked) => setConfirmed(checked === true)} />
						<FieldLabel htmlFor="secret-confirm" className="font-normal">
							{t("confirm")}
						</FieldLabel>
					</Field>
				</FieldGroup>

				<DialogFooter>
					<Button disabled={!confirmed} onClick={onClose}>
						{t("done")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
