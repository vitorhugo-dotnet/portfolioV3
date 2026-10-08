import type { MetadataRoute } from "next";
import { canonicalOrigin } from "../lib/site-config.ts";
export const dynamic = "force-static";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${canonicalOrigin}/sitemap.xml`,
  };
}
