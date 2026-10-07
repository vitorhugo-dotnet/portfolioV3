import type { MetadataRoute } from "next";
import { sitemapOrigin } from "../lib/site-config";
export const dynamic = "force-static";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${sitemapOrigin}/sitemap.xml`,
  };
}
