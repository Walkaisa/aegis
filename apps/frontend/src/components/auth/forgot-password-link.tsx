import Link from "next/link";
import { useTranslations } from "next-intl";

/** Offered below the password field of both sign-in pages; `challenge` leads back to the application sign-in. */
export function ForgotPasswordLink({ challenge }: { challenge?: string }) {
	const t = useTranslations("forgotPassword");

	return (
		<Link
			href={challenge ? `/forgot-password?challenge=${encodeURIComponent(challenge)}` : "/forgot-password"}
			className="-mt-2 w-fit rounded-md text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
		>
			{t("title")}
		</Link>
	);
}
