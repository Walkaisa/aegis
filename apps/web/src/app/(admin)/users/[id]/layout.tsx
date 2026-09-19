import type { ReactNode } from "react";
import { UserLayout } from "@/components/users/user-layout";

export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
	const { id } = await params;
	return <UserLayout id={id}>{children}</UserLayout>;
}
