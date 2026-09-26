"use client";

import type { VersionStatusDto } from "@aegis/contracts";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo } from "react";
import { useAccount } from "@/components/dashboard/account-context";
import { useApiQuery } from "@/hooks/use-api-query";
import { type ApiRequestError, api } from "@/lib/api";

/** How often an open administration picks up the result of the server's latest check; as often as the server checks. */
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

interface VersionStatusContextValue {
	status: VersionStatusDto | undefined;
	error: ApiRequestError | null;
	reload: () => Promise<void>;
	/** Asks the server to look for a new release right away. */
	check: () => Promise<VersionStatusDto>;
}

const VersionStatusContext = createContext<VersionStatusContextValue | null>(null);

/** The running version and the newest release, shared by the sidebar and the settings. */
export function VersionStatusProvider({ children }: { children: ReactNode }) {
	const { me } = useAccount();
	const allowed = me.permissions.includes("settings:read");
	const { data, error, reload, setData } = useApiQuery<VersionStatusDto>(allowed ? "/settings/updates" : null);

	useEffect(() => {
		if (!allowed) {
			return;
		}
		const timer = window.setInterval(() => void reload(), REFRESH_INTERVAL_MS);
		return () => window.clearInterval(timer);
	}, [allowed, reload]);

	const check = useCallback(async () => {
		const status = await api.post<VersionStatusDto>("/settings/updates/check");
		setData(status);
		return status;
	}, [setData]);

	const value = useMemo(() => ({ status: data, error, reload, check }), [data, error, reload, check]);

	return <VersionStatusContext.Provider value={value}>{children}</VersionStatusContext.Provider>;
}

export function useVersionStatus(): VersionStatusContextValue {
	const context = useContext(VersionStatusContext);
	if (!context) {
		throw new Error("useVersionStatus must be used within VersionStatusProvider");
	}
	return context;
}
