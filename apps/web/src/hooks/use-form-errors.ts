"use client";

import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, toValidationIssues, type ValidationIssue } from "@aegis/contracts";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import type { z } from "zod";
import { ApiRequestError } from "@/lib/api";

const MESSAGE_VALUES = {
	min: PASSWORD_MIN_LENGTH,
	max: PASSWORD_MAX_LENGTH,
	emailMax: EMAIL_MAX_LENGTH,
};

export type FieldErrors = Record<string, string>;

/**
 * Shared field-error handling: client-side validation with the contract schemas and
 * server-side validation issues end up in the same translated structure.
 */
export function useFormErrors() {
	const t = useTranslations("validation");
	const [errors, setErrors] = useState<FieldErrors>({});

	const translate = useCallback((code: string) => (t.has(code) ? t(code, MESSAGE_VALUES) : t("invalid")), [t]);

	const applyIssues = useCallback(
		(issues: ValidationIssue[]) => {
			const next: FieldErrors = {};
			for (const issue of issues) {
				next[issue.path] ??= translate(issue.code);
			}
			setErrors(next);
		},
		[translate],
	);

	const validate = useCallback(
		<S extends z.ZodType>(schema: S, value: unknown): z.output<S> | null => {
			const result = schema.safeParse(value);
			if (result.success) {
				setErrors({});
				return result.data;
			}
			applyIssues(toValidationIssues(result.error));
			return null;
		},
		[applyIssues],
	);

	/** Applies server-side validation issues; returns false for any other error. */
	const applyApiError = useCallback(
		(error: unknown): boolean => {
			if (error instanceof ApiRequestError && error.code === "validation_failed") {
				applyIssues(error.issues);
				return true;
			}
			return false;
		},
		[applyIssues],
	);

	const setFieldError = useCallback(
		(path: string, code: string) => {
			setErrors((previous) => ({ ...previous, [path]: translate(code) }));
		},
		[translate],
	);

	const clear = useCallback(() => setErrors({}), []);

	return { errors, validate, applyApiError, setFieldError, setErrors, clear };
}
