import type { ReactNode } from "react";
import { UserLayout } from "@/components/users/user-layout";

/** Exported once, as `users/[id]`: the backend serves it for every account id. */
export function generateStaticParams() {
	return [{ id: "[id]" }];
}

export const dynamicParams = false;

export default function Layout({ children }: { children: ReactNode }) {
	return <UserLayout>{children}</UserLayout>;
}
