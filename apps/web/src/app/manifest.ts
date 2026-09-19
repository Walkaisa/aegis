import type { MetadataRoute } from "next";
import { BRAND_COLOR, BRAND_ICONS } from "@/lib/brand";

/**
 * Served at `/manifest.webmanifest`. It stays a route instead of a static file in `public` so the
 * brand colour and the icon paths have a single definition; the icons themselves are static files.
 */
export default function manifest(): MetadataRoute.Manifest {
	return {
		id: "/",
		name: "Aegis",
		short_name: "Aegis",
		start_url: "/",
		scope: "/",
		display: "standalone",
		background_color: BRAND_COLOR,
		theme_color: BRAND_COLOR,
		// The mark stays inside the central 80 % safe zone, so the same file serves both purposes.
		icons: [
			{ src: BRAND_ICONS.maskable192, sizes: "192x192", type: "image/png", purpose: "any" },
			{ src: BRAND_ICONS.maskable512, sizes: "512x512", type: "image/png", purpose: "any" },
			{ src: BRAND_ICONS.maskable192, sizes: "192x192", type: "image/png", purpose: "maskable" },
			{ src: BRAND_ICONS.maskable512, sizes: "512x512", type: "image/png", purpose: "maskable" },
		],
	};
}
