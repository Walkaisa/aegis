import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiError, mockApi } from "../../support/api";

describe("useApiQuery", () => {
	it("loads, reloads and replaces the data", async () => {
		const server = mockApi({ "GET /api/users": { body: { users: ["ada"] } } });
		const { result, act } = await renderHook(() => useApiQuery<{ users: string[] }>("/users"));

		await expect.poll(() => result.current.data).toEqual({ users: ["ada"] });
		expect(result.current).toMatchObject({ loading: false, error: null });

		server.on({ "GET /api/users": { body: { users: ["ada", "grace"] } } });
		await act(() => result.current.reload());
		expect(result.current.data).toEqual({ users: ["ada", "grace"] });

		act(() => result.current.setData({ users: [] }));
		expect(result.current.data).toEqual({ users: [] });
	});

	it("does nothing without a path", async () => {
		const { result, act } = await renderHook(() => useApiQuery(null));

		await act(() => result.current.reload());
		expect(result.current).toMatchObject({ data: undefined, loading: false, error: null });
	});

	it("keeps the last data when a reload fails", async () => {
		const server = mockApi({ "GET /api/users": { body: { users: [] } } });
		const { result, act } = await renderHook(() => useApiQuery("/users"));
		await expect.poll(() => result.current.data).toEqual({ users: [] });

		server.on({ "GET /api/users": apiError(503, "setup_required") });
		await act(() => result.current.reload());

		expect(result.current).toMatchObject({ data: { users: [] }, loading: false, error: { code: "setup_required" } });
	});

	it("ignores answers to requests that a newer one replaced", async () => {
		let call = 0;
		mockApi({
			"GET /api/users": () => {
				call += 1;
				return call % 2 === 1 ? apiError(500, "internal_error") : { body: { call } };
			},
		});
		const { result, act } = await renderHook(() => useApiQuery<{ call: number }>("/users"));
		await expect.poll(() => result.current.loading).toBe(false);

		await act(async () => {
			const first = result.current.reload();
			const second = result.current.reload();
			await Promise.all([first, second]);
		});

		expect(result.current.error).toBeNull();
		expect(result.current.data?.call).toBeGreaterThan(0);
	});
});
