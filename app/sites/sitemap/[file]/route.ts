import { sitemapData } from "../../../../lib/sitemap-data";
import { sitemapXml } from "../../../../lib/sitemap-xml";
export const dynamic = "force-static";
export const dynamicParams = false;
export async function generateStaticParams() {
  return Object.keys(await sitemapData()).map((host) => ({
    file: `${host}.xml`,
  }));
}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const groups = await sitemapData();
  const { file } = await params;
  const urls = groups[file.replace(/\.xml$/, "")];
  if (!urls) return new Response("Not found", { status: 404 });
  return new Response(sitemapXml(urls), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
