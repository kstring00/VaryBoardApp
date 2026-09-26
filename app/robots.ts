import type { MetadataRoute } from "next";
import { siteUrl, vercelEnv } from "@/lib/env";

/** Only the /app landing is indexable, and only on production. Every other app route is noindex. */
export default function robots(): MetadataRoute.Robots {
  if (vercelEnv && vercelEnv !== "production") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: ["/app$"], disallow: ["/app/"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
