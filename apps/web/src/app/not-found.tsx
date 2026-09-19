import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default async function NotFound() {
	const t = await getTranslations("notFound");

	return (
		<main className="flex min-h-svh items-center justify-center p-4">
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FileQuestion />
					</EmptyMedia>
					<EmptyTitle>{t("title")}</EmptyTitle>
					<EmptyDescription>{t("description")}</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button asChild variant="outline">
						<Link href="/">{t("home")}</Link>
					</Button>
				</EmptyContent>
			</Empty>
		</main>
	);
}
