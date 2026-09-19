import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/components/dashboard/app-shell";

/** The administration UI. The server only proxies these pages for a signed-in admin. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
	const cookieStore = await cookies();
	// Remember whether the sidebar was collapsed (cookie written by the shadcn sidebar).
	const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

	return <AppShell defaultOpen={defaultOpen}>{children}</AppShell>;
}
