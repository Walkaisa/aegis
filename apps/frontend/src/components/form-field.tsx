import type { ReactNode } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

/** Label, control, description and error message for a single form control. */
export function FormField({
	id,
	label,
	description,
	error,
	children,
}: {
	id: string;
	label: ReactNode;
	description?: ReactNode;
	error?: string;
	children: ReactNode;
}) {
	return (
		<Field data-invalid={error ? true : undefined}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			{children}
			{description && !error ? <FieldDescription>{description}</FieldDescription> : null}
			<FieldError>{error}</FieldError>
		</Field>
	);
}
