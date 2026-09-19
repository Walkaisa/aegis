import type { ComponentProps, ReactNode } from "react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

/** Text input with an optional leading icon, sized for the sign-in pages. */
export function IconInput({ icon, className, ...props }: ComponentProps<"input"> & { icon?: ReactNode }) {
	return (
		<InputGroup className={cn("h-9", className)}>
			{icon ? <InputGroupAddon aria-hidden="true">{icon}</InputGroupAddon> : null}
			<InputGroupInput {...props} />
		</InputGroup>
	);
}
