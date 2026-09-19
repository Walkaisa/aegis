"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { useErrorMessage } from "@/hooks/use-error-message";

/** Confirmation for consequential actions. Errors are reported as a toast and keep the dialog open. */
export function ConfirmDialog({
	trigger,
	open: controlledOpen,
	onOpenChange,
	title,
	description,
	confirmLabel,
	destructive = false,
	onConfirm,
}: {
	/** Opens the dialog; omit it to control the dialog through `open` instead. */
	trigger?: ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	title: ReactNode;
	description: ReactNode;
	confirmLabel: ReactNode;
	destructive?: boolean;
	onConfirm: () => Promise<void>;
}) {
	const t = useTranslations("common");
	const errorMessage = useErrorMessage();
	const [internalOpen, setInternalOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const open = controlledOpen ?? internalOpen;
	const setOpen = (next: boolean) => {
		setInternalOpen(next);
		onOpenChange?.(next);
	};

	async function confirm() {
		setPending(true);
		try {
			await onConfirm();
			setOpen(false);
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setPending(false);
		}
	}

	return (
		<AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
			{trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
					<AlertDialogAction
						variant={destructive ? "destructive" : "default"}
						disabled={pending}
						onClick={(event) => {
							event.preventDefault();
							void confirm();
						}}
					>
						{pending ? <Spinner /> : null}
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
