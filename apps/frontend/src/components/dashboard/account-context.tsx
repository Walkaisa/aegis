"use client";

import type { AuthSessionResponse } from "@aegis/contracts";
import { createContext, type ReactNode, useContext } from "react";

interface AccountContextValue {
	me: AuthSessionResponse;
	reload: () => Promise<void>;
	update: (me: AuthSessionResponse) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ value, children }: { value: AccountContextValue; children: ReactNode }) {
	return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

/** The signed-in account, its session and permissions. */
export function useAccount(): AccountContextValue {
	const context = useContext(AccountContext);
	if (!context) {
		throw new Error("useAccount must be used within AccountProvider");
	}
	return context;
}
