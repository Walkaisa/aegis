import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * `next build` exports every page as static files to `out/`, which the backend serves in
 * production; there is no Next.js server at runtime. `next dev` serves the same pages with hot
 * reloading behind the backend.
 */
const nextConfig: NextConfig = {
	output: "export",
	// Images are served as they are; there is no server to optimize them.
	images: { unoptimized: true },
	poweredByHeader: false,
	reactStrictMode: true,
	// In development the pages are reached through the backend on another port.
	allowedDevOrigins: ["localhost", "127.0.0.1"],
};

export default withNextIntl(nextConfig);
