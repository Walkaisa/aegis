"use client";

import { parseUserAgent } from "@aegis/contracts";
import { Monitor, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";

export function DeviceIcon({ userAgent }: { userAgent: string | null }) {
	return parseUserAgent(userAgent).mobile ? <Smartphone /> : <Monitor />;
}

/** Human-readable device description, e.g. "Firefox on Windows". */
export function useDeviceLabel() {
	const t = useTranslations("devices");

	return useCallback(
		(userAgent: string | null) => {
			const { browser, os } = parseUserAgent(userAgent);
			if (browser && os) {
				return t("browserOnOs", { browser, os });
			}
			return browser ?? os ?? t("unknown");
		},
		[t],
	);
}
