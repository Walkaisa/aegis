"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ComponentProps, type ReactNode, useState } from "react";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";

/** Password field with a visibility toggle. The value is passed through untouched. */
export function PasswordInput({
	className,
	icon,
	...props
}: Omit<ComponentProps<"input">, "type"> & {
	/** Optional icon in front of the value. */
	icon?: ReactNode;
}) {
	const t = useTranslations("common");
	const [visible, setVisible] = useState(false);

	return (
		<InputGroup className={className}>
			{icon ? <InputGroupAddon>{icon}</InputGroupAddon> : null}
			<InputGroupInput type={visible ? "text" : "password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} {...props} />
			<InputGroupAddon align="inline-end">
				<InputGroupButton
					size="icon-xs"
					aria-label={visible ? t("hidePassword") : t("showPassword")}
					aria-pressed={visible}
					onClick={() => setVisible((current) => !current)}
				>
					{visible ? <EyeOff /> : <Eye />}
				</InputGroupButton>
			</InputGroupAddon>
		</InputGroup>
	);
}
