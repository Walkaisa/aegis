"use client";

import { useEffect, useState } from "react";

/**
 * The token of a link sent by e-mail. It travels in the URL fragment (`#token=…`), which browsers
 * never send to a server, so it stays out of every access log on its way. `undefined` until read.
 */
export function useLinkToken(): string | null | undefined {
	const [token, setToken] = useState<string | null | undefined>(undefined);

	useEffect(() => {
		setToken(new URLSearchParams(window.location.hash.slice(1)).get("token") || null);
	}, []);

	return token;
}
