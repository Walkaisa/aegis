import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Marks a session whose sign-in was confirmed with a second factor. */
export function SecondFactorBadge() {
	const t = useTranslations("sessions");

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Badge variant="outline" className="gap-1 border-success/30 text-success">
					<ShieldCheck />
					{t("secondFactor")}
				</Badge>
			</TooltipTrigger>
			<TooltipContent>{t("secondFactorHint")}</TooltipContent>
		</Tooltip>
	);
}
