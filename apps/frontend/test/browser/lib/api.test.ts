import { describe, expect, it, vi } from "vitest";
import { ApiRequestError, api, apiUrl, isAbortError, requestJson, toApiRequestError } from "@/lib/api";
import { loadPage } from "@/lib/browser";
import { apiError, mockApi } from "../../support/api";

describe("api", () => {
	it("sends JSON to the Aegis API and reads JSON back", async () => {
		const server = mockApi({
			"GET /api/users": { body: { users: [] } },
			"POST /api/users": ({ body }) => ({ status: 201, body: { created: body } }),
			"PUT /api/users/1": ({ body }) => ({ body }),
			"PATCH /api/settings": ({ body }) => ({ body }),
			"DELETE /api/users/1": { status: 204 },
		});

		expect(await api.get("/users")).toEqual({ users: [] });
		expect(await api.post("/users", { name: "Ada" })).toEqual({ created: { name: "Ada" } });
		expect(await api.put("/users/1", { name: "Grace" })).toEqual({ name: "Grace" });
		expect(await api.patch("/settings", { days: 7 })).toEqual({ days: 7 });
		expect(await api.delete("/users/1")).toBeUndefined();

		const [created] = server.calls("POST /api/users");
		expect(created?.headers.get("content-type")).toBe("application/json");
		expect(created?.headers.get("accept")).toBe("application/json");
		expect(server.calls("GET /api/users")[0]?.headers.get("content-type")).toBeNull();
		expect(apiUrl("/users")).toBe("/api/users");
	});

	it("uploads files with their own content type", async () => {
		const server = mockApi({ "PUT /api/account/avatar": { body: { ok: true } } });

		await api.upload("/account/avatar", new Blob(["png"], { type: "image/png" }));

		const [upload] = server.calls("PUT /api/account/avatar");
		expect(upload?.headers.get("content-type")).toBe("image/png");
		expect(upload?.body).toBeInstanceOf(Blob);
	});

	it("turns error responses into ApiRequestError", async () => {
		mockApi({
			"POST /api/users": apiError(400, "validation_failed", [{ path: "email", code: "invalid" }]),
			"GET /api/limited": { status: 429 },
			"GET /api/broken": { status: 502 },
		});

		const invalid = await api.post("/users", {}).catch((error: unknown) => error);
		expect(invalid).toBeInstanceOf(ApiRequestError);
		expect(invalid).toMatchObject({
			status: 400,
			code: "validation_failed",
			issues: [{ path: "email", code: "invalid" }],
			name: "ApiRequestError",
		});

		await expect(requestJson("/api/limited")).rejects.toMatchObject({ status: 429, code: "rate_limited", issues: [] });
		await expect(requestJson("/api/broken")).rejects.toMatchObject({ status: 502, code: "internal_error" });
	});

	it("reports network failures and passes aborts through", async () => {
		mockApi({ "GET /api/down": "network-error", "GET /api/slow": "pending" });
		const controller = new AbortController();

		await expect(api.get("/down")).rejects.toMatchObject({ status: 0, code: "network_error" });
		const slow = api.get("/slow", controller.signal);
		controller.abort();
		const aborted = await slow.catch((error: unknown) => error);
		expect(isAbortError(aborted)).toBe(true);
		expect(isAbortError(new Error("other"))).toBe(false);
	});

	it("reports anything unexpected as an internal error", () => {
		const known = new ApiRequestError(409, "email_taken", "taken");

		expect(toApiRequestError(known)).toBe(known);
		expect(toApiRequestError(new Error("boom"))).toMatchObject({ status: 0, code: "internal_error", message: "Error: boom" });
	});

	it("sends an expired session back to the sign-in, with the way back", async () => {
		mockApi({ "GET /api/users": apiError(401, "unauthorized"), "POST /api/auth/session": apiError(401, "unauthorized") });

		window.history.replaceState(null, "", "/users?page=2");
		await expect(api.get("/users")).rejects.toMatchObject({ status: 401 });
		expect(loadPage).toHaveBeenLastCalledWith("/sign-in?next=%2Fusers%3Fpage%3D2");

		window.history.replaceState(null, "", "/");
		await expect(api.get("/users")).rejects.toMatchObject({ status: 401 });
		expect(loadPage).toHaveBeenLastCalledWith("/sign-in");

		vi.mocked(loadPage).mockClear();
		window.history.replaceState(null, "", "/sign-in");
		await expect(api.post("/auth/session", {})).rejects.toMatchObject({ status: 401 });
		expect(loadPage).not.toHaveBeenCalled();
	});
});
