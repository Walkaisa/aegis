"use client";

import { SUPPORTED_SCOPES, type SupportedScope } from "@aegis/contracts";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";

/** The scopes an application may request. `openid` is always part of it. */
export function ScopeSelector({
	value,
	onChange,
	idPrefix,
}: {
	value: readonly SupportedScope[];
	onChange: (scopes: SupportedScope[]) => void;
	idPrefix: string;
}) {
	const t = useTranslations("clientForm");

	const toggle = (scope: SupportedScope, checked: boolean) => {
		const next = new Set(value);
		if (checked) {
			next.add(scope);
		} else {
			next.delete(scope);
		}
		next.add("openid");
		onChange(SUPPORTED_SCOPES.filter((entry) => next.has(entry)));
	};

	return (
		<ul className="divide-y overflow-hidden rounded-lg border">
			{SUPPORTED_SCOPES.map((scope) => {
				const id = `${idPrefix}-scope-${scope}`;
				const required = scope === "openid";
				return (
					<li key={scope}>
						<label htmlFor={id} className="flex cursor-pointer items-start gap-3 px-3 py-3 text-sm has-disabled:cursor-default">
							<Checkbox
								id={id}
								className="mt-0.5"
								checked={required || value.includes(scope)}
								disabled={required}
								onCheckedChange={(checked) => toggle(scope, checked === true)}
							/>
							<span className="flex min-w-0 flex-col gap-0.5">
								<span className="flex items-center gap-2">
									<code className="font-mono text-xs font-medium">{scope}</code>
									{required ? <span className="text-xs text-muted-foreground">{t("scopeRequired")}</span> : null}
								</span>
								<span className="text-muted-foreground">{t(`scopeDescriptions.${scope}`)}</span>
							</span>
						</label>
					</li>
				);
			})}
		</ul>
	);
}
