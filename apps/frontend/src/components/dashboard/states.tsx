"use client";

import { CircleAlert, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useErrorMessage } from "@/hooks/use-error-message";

const SKELETON_KEYS = ["first", "second", "third", "fourth", "fifth", "sixth"];

export function LoadingState({ rows = 3, className = "h-16" }: { rows?: number; className?: string }) {
	return (
		<div className="flex flex-col gap-3" aria-busy="true">
			{SKELETON_KEYS.slice(0, rows).map((key) => (
				<Skeleton key={key} className={`${className} w-full rounded-xl`} />
			))}
		</div>
	);
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
	const t = useTranslations("common");
	const errorMessage = useErrorMessage();

	return (
		<Alert variant="destructive">
			<CircleAlert />
			<AlertTitle>{t("loadFailed")}</AlertTitle>
			<AlertDescription>{errorMessage(error)}</AlertDescription>
			{onRetry ? (
				<AlertAction>
					<Button variant="outline" size="sm" onClick={onRetry}>
						<RefreshCw />
						{t("retry")}
					</Button>
				</AlertAction>
			) : null}
		</Alert>
	);
}
