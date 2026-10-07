import { toast } from "sonner";
import { afterEach, beforeEach, vi } from "vitest";
import { configure } from "vitest-browser-react/pure";
import { verifyApi } from "../support/api";
import { resetNavigation } from "../support/next/navigation";

// Like `reactStrictMode` in next.config.ts: effects run twice, so missing cleanups surface here.
configure({ reactStrictMode: true });

vi.mock("next/navigation", () => import("../support/next/navigation"));
vi.mock("next/link", () => import("../support/next/link"));
vi.mock("next/image", () => import("../support/next/image"));
// Full page loads would navigate the test page away.
vi.mock("@/lib/browser", () => ({ loadPage: vi.fn(), reloadPage: vi.fn() }));

const initialUrl = window.location.href;

beforeEach(() => {
	resetNavigation();
});

afterEach(() => {
	// Toasts live in a module-level store; a toast of one test must not satisfy an assertion of the next.
	toast.dismiss();
	for (const cookie of document.cookie.split("; ").filter(Boolean)) {
		// biome-ignore lint/suspicious/noDocumentCookie: tests start without the cookies of the previous one
		document.cookie = `${cookie.split("=")[0]}=; Path=/; Max-Age=0`;
	}
	window.history.replaceState(null, "", initialUrl);
	localStorage.clear();
	verifyApi();
});
