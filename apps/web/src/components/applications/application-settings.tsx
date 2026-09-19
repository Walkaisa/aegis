"use client";

import type { ClientResponse } from "@aegis/contracts";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useApplication } from "@/components/applications/application-layout";
import { ClientForm } from "@/components/applications/client-form";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DangerZone } from "@/components/dashboard/page";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export function ApplicationSettings() {
	const t = useTranslations("clientForm");
	const router = useRouter();
	const { client, path, setClient } = useApplication();

	async function remove() {
		await api.delete(path);
		toast.success(t("deleted", { name: client.name }));
		router.push("/applications");
	}

	return (
		<div className="flex max-w-3xl flex-col gap-6">
			<ClientForm
				key={client.updatedAt}
				client={client}
				onSubmit={async (values) => {
					const result = await api.put<ClientResponse>(path, values);
					setClient(result.client);
					toast.success(t("saved"));
				}}
			/>

			<DangerZone
				title={t("danger")}
				description={t("dangerDescription")}
				action={
					<ConfirmDialog
						trigger={
							<Button variant="destructive">
								<Trash2 />
								{t("delete")}
							</Button>
						}
						title={t("deleteTitle")}
						description={t("deleteDescription", { name: client.name })}
						confirmLabel={t("deleteConfirm")}
						destructive
						onConfirm={remove}
					/>
				}
			>
				{t("deleteHint")}
			</DangerZone>
		</div>
	);
}
