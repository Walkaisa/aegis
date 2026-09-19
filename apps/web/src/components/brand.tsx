import Image from "next/image";
import { BRAND_COLOR, BRAND_LOGO } from "@/lib/brand";
import { cn } from "@/lib/utils";

const MARK_SIZES = {
	xs: "size-4 rounded-sm",
	sm: "size-7 rounded-md",
	md: "size-8 rounded-lg",
	lg: "size-12 rounded-xl",
} as const;

export function BrandMark({ size = "md", className }: { size?: keyof typeof MARK_SIZES; className?: string }) {
	return (
		<div className={cn("shrink-0 overflow-hidden", MARK_SIZES[size], className)} style={{ backgroundColor: BRAND_COLOR }}>
			<Image src={BRAND_LOGO} alt="" width={200} height={200} className="size-full" unoptimized />
		</div>
	);
}

export function Brand({ name, className }: { name: string; className?: string }) {
	return (
		<div className={cn("flex min-w-0 items-center gap-2.5", className)}>
			<BrandMark size="sm" />
			<span className="truncate text-sm font-semibold tracking-tight">{name}</span>
		</div>
	);
}
