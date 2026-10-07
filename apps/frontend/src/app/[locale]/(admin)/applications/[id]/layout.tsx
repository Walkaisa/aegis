import type { ReactNode } from "react";
import { ApplicationLayout } from "@/components/applications/application-layout";

/** Exported once, as `applications/[id]`: the backend serves it for every application id. */
export function generateStaticParams() {
	return [{ id: "[id]" }];
}

export const dynamicParams = false;

export default function Layout({ children }: { children: ReactNode }) {
	return <ApplicationLayout>{children}</ApplicationLayout>;
}
