"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { ApiRequestError } from "@/lib/api";

/** Translates any thrown error into a user-facing message. */
export function useErrorMessage() {
	const t = useTranslations("errors");

	return useCallback(
		(error: unknown): string => {
			if (error instanceof ApiRequestError && t.has(error.code)) {
				return t(error.code);
			}
			return t("internal_error");
		},
		[t],
	);
}
