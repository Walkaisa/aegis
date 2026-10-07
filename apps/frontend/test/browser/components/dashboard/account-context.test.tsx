import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { useAccount } from "@/components/dashboard/account-context";

describe("useAccount", () => {
	it("requires its provider", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		function Account() {
			useAccount();
			return null;
		}

		await expect(render(<Account />)).rejects.toThrow("useAccount must be used within AccountProvider");
	});
});
