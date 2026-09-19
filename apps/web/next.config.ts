import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
	output: "standalone",
	outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
	poweredByHeader: false,
	reactStrictMode: true,
	// In development the UI is reached through the Aegis server on another port.
	allowedDevOrigins: ["localhost", "127.0.0.1"],
};

export default withNextIntl(nextConfig);
