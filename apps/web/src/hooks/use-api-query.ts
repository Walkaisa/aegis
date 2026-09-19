"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError, apiUrl, isAbortError, requestJson } from "@/lib/api";

interface QueryState<T> {
	data: T | undefined;
	error: ApiRequestError | null;
	loading: boolean;
}

/** Minimal data-fetching hook for an endpoint of the Aegis API, e.g. `useApiQuery("/users")`. */
export function useApiQuery<T>(path: string | null) {
	return useJsonQuery<T>(path === null ? null : apiUrl(path));
}

/** Minimal data-fetching hook for any same-origin JSON document. */
export function useJsonQuery<T>(url: string | null) {
	const [state, setState] = useState<QueryState<T>>({
		data: undefined,
		error: null,
		loading: url !== null,
	});
	const controllerRef = useRef<AbortController | null>(null);

	const load = useCallback(async () => {
		if (url === null) {
			return;
		}
		controllerRef.current?.abort();
		const controller = new AbortController();
		controllerRef.current = controller;

		setState((previous) => ({ ...previous, loading: true, error: null }));
		try {
			const data = await requestJson<T>(url, { signal: controller.signal });
			if (!controller.signal.aborted) {
				setState({ data, error: null, loading: false });
			}
		} catch (error) {
			if (isAbortError(error) || controller.signal.aborted) {
				return;
			}
			setState((previous) => ({
				data: previous.data,
				error: error instanceof ApiRequestError ? error : new ApiRequestError(0, "internal_error", String(error)),
				loading: false,
			}));
		}
	}, [url]);

	useEffect(() => {
		void load();
		return () => controllerRef.current?.abort();
	}, [load]);

	const setData = useCallback((data: T) => {
		setState((previous) => ({ ...previous, data }));
	}, []);

	return { ...state, reload: load, setData };
}
