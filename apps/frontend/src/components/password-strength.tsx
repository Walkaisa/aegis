"use client";

import {
	evaluatePassword,
	PASSWORD_MIN_LENGTH,
	PASSWORD_REQUIREMENTS,
	type PasswordStrengthLevel,
	passwordStrength,
} from "@aegis/contracts";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const LEVEL_COLOR: Record<PasswordStrengthLevel, string> = {
	weak: "var(--strength-weak)",
	fair: "var(--strength-fair)",
	good: "var(--strength-good)",
	strong: "var(--strength-strong)",
};

/**
 * Shows how strong a new password is and which requirements it already meets. The meter unfolds
 * once something has been typed. Only the minimum length is enforced; the remaining checks guide
 * towards a stronger password.
 */
export function PasswordStrength({ password, className }: { password: string; className?: string }) {
	const t = useTranslations("password");
	const checks = evaluatePassword(password);
	const { score, level } = passwordStrength(password);
	const color = LEVEL_COLOR[level];
	const visible = password.length > 0;

	return (
		<div
			aria-hidden={!visible}
			className={cn(
				"grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out motion-reduce:transition-none",
				// The negative margin swallows the gap of the surrounding field while collapsed.
				visible ? "grid-rows-[1fr] opacity-100" : "-mt-2 grid-rows-[0fr] opacity-0",
			)}
		>
			<div className="min-h-0 overflow-hidden">
				<div className={cn("@container flex flex-col gap-2.5 rounded-lg border bg-muted/30 p-3", className)}>
					<div className="flex items-center justify-between gap-3">
						<div className="flex flex-1 gap-1" aria-hidden="true">
							{PASSWORD_REQUIREMENTS.map((requirement, index) => (
								<span
									key={requirement}
									className="h-1.5 flex-1 rounded-full bg-secondary transition-colors duration-300 motion-reduce:transition-none"
									style={index < score ? { backgroundColor: color } : undefined}
								/>
							))}
						</div>
						<p role="status" aria-live="polite" className="shrink-0 text-xs">
							<span className="sr-only">{t("strength")}: </span>
							<span style={{ color }} className="font-medium">
								{visible ? t(`levels.${level}`) : null}
							</span>
						</p>
					</div>

					<ul className="grid gap-1.5 @sm:grid-cols-2">
						{PASSWORD_REQUIREMENTS.map((requirement) => {
							const met = checks[requirement];
							return (
								<li
									key={requirement}
									className={cn(
										"flex items-center gap-2 text-xs transition-colors duration-200 motion-reduce:transition-none",
										met ? "text-success" : "text-destructive",
									)}
								>
									<span
										className={cn(
											"flex size-4 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
											met ? "bg-success/15" : "bg-destructive/12",
										)}
									>
										{met ? (
											<Check className="size-2.5" strokeWidth={3} aria-hidden="true" />
										) : (
											<X className="size-2.5" strokeWidth={3} aria-hidden="true" />
										)}
									</span>
									<span>{t(`requirements.${requirement}`, { min: PASSWORD_MIN_LENGTH })}</span>
									<span className="sr-only">{met ? t("met") : t("notMet")}</span>
								</li>
							);
						})}
					</ul>
				</div>
			</div>
		</div>
	);
}
