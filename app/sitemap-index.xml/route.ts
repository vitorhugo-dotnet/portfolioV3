import { sitemapOrigin } from "../../lib/site-config";
import { sitemapData } from "../../lib/sitemap-data";
import { sitemapIndexXml } from "../../lib/sitemap-xml";
export const dynamic = "force-static";
export async function GET() {
  const groups = await sitemapData();
  const urls = Object.keys(groups).map(
    (host) => `${sitemapOrigin}/sites/sitemap/${encodeURIComponent(host)}.xml`,
  );
  return new Response(sitemapIndexXml(urls), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
