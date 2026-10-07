import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { useLinkToken } from "@/hooks/use-link-token";

describe("useLinkToken", () => {
	it("reads the token from the fragment of the link", async () => {
		window.history.replaceState(null, "", "/reset-password#token=secret");
		const withToken = await renderHook(() => useLinkToken());
		await expect.poll(() => withToken.result.current).toBe("secret");

		window.history.replaceState(null, "", "/reset-password");
		const withoutToken = await renderHook(() => useLinkToken());
		await expect.poll(() => withoutToken.result.current).toBeNull();
	});
});
