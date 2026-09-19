import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const GRADIENTS = [
	"from-indigo-500 to-violet-600",
	"from-sky-500 to-blue-600",
	"from-emerald-500 to-teal-600",
	"from-amber-400 to-orange-500",
	"from-rose-500 to-pink-600",
	"from-fuchsia-500 to-purple-600",
	"from-cyan-500 to-sky-600",
	"from-lime-500 to-green-600",
];

/** Small logos in tables and lists are round like profile pictures; large ones are rounded squares. */
const SIZES = {
	xs: { root: "size-5 rounded-full", text: "text-[10px]" },
	sm: { root: "size-8 rounded-full", text: "text-xs" },
	md: { root: "size-10 rounded-full", text: "text-sm" },
	lg: { root: "size-12 rounded-xl", text: "text-base" },
	xl: { root: "size-14 rounded-2xl", text: "text-lg" },
} as const;

function gradientFor(name: string): string {
	let hash = 0;
	for (const character of name) {
		hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
	}
	return GRADIENTS[hash % GRADIENTS.length] ?? "from-indigo-500 to-violet-600";
}

/**
 * Logo of an application. Without one, or while it is loading, a colorful monogram stands in;
 * its color is derived from the name.
 */
export function AppAvatar({
	name,
	src,
	size = "md",
	className,
}: {
	name: string;
	src?: string | null;
	size?: keyof typeof SIZES;
	className?: string;
}) {
	const letters = initials(name || "?");
	const style = SIZES[size];

	return (
		<Avatar
			aria-hidden="true"
			className={cn(style.root, "shadow-sm after:rounded-[inherit] after:border-black/5 dark:after:border-white/10", className)}
		>
			{src ? <AvatarImage src={src} alt="" className="rounded-[inherit] bg-background" draggable={false} /> : null}
			<AvatarFallback className={cn("rounded-[inherit] bg-linear-to-br font-semibold text-white", gradientFor(name), style.text)}>
				{size === "xs" ? Array.from(letters)[0] : letters}
			</AvatarFallback>
		</Avatar>
	);
}
