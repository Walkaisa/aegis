import type { ReactNode } from "react";
import { ApplicationLayout } from "@/components/applications/application-layout";

export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
	const { id } = await params;
	return <ApplicationLayout id={id}>{children}</ApplicationLayout>;
}
