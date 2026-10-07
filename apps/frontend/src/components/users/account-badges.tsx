"use client";

import type { Role } from "@aegis/contracts";
import { ShieldCheck, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** The role of an account; admins stand out everywhere they appear. */
export function RoleBadge({ role, className }: { role: Role; className?: string }) {
	const t = useTranslations("roles");

	return role === "admin" ? (
		<Badge variant="outline" className={cn("gap-1 border-primary/25 bg-primary/10 text-primary", className)}>
			<ShieldCheck />
			{t("admin")}
		</Badge>
	) : (
		<Badge variant="outline" className={cn("gap-1", className)}>
			<UserRound />
			{t("user")}
		</Badge>
	);
}

export function AccountStatus({ enabled }: { enabled: boolean }) {
	const t = useTranslations("accountStatus");

	return (
		<span className="inline-flex items-center gap-1.5 text-sm">
			<span className={cn("size-1.5 rounded-full", enabled ? "bg-success" : "bg-muted-foreground/60")} />
			{enabled ? t("enabled") : t("disabled")}
		</span>
	);
}

const AVATAR_SIZES = {
	sm: { root: "size-8 rounded-lg", inner: "rounded-lg text-xs" },
	"sm-round": { root: "size-8", inner: "text-xs" },
	md: { root: "size-9", inner: "text-xs" },
	lg: { root: "size-14 rounded-2xl", inner: "rounded-2xl text-lg" },
} as const;

/** Profile picture of an account, with its initials as fallback while there is none or it is loading. */
export function UserAvatar({
	name,
	src,
	size = "md",
	className,
}: {
	name: string;
	src?: string | null;
	size?: keyof typeof AVATAR_SIZES;
	className?: string;
}) {
	const style = AVATAR_SIZES[size];

	return (
		<Avatar className={cn(style.root, "after:rounded-[inherit]", className)}>
			{src ? <AvatarImage src={src} alt="" className={style.inner} draggable={false} /> : null}
			<AvatarFallback className={cn("bg-primary/10 font-medium text-primary", style.inner)}>{initials(name)}</AvatarFallback>
		</Avatar>
	);
}
