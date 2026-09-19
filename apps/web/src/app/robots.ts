import type { MetadataRoute } from "next";

/** Aegis is a private identity provider; nothing in it belongs in a search index. */
export default function robots(): MetadataRoute.Robots {
	return {
		rules: { userAgent: "*", disallow: "/" },
	};
}
