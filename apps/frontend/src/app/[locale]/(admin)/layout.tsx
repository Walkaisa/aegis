import type { ReactNode } from "react";
import { AppShell } from "@/components/dashboard/app-shell";

/** The administration UI. The backend only serves these pages to a signed-in admin. */
export default function AdminLayout({ children }: { children: ReactNode }) {
	return <AppShell>{children}</AppShell>;
}
