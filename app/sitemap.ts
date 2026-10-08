import type { MetadataRoute } from "next";
import type { Locale } from "../i18n/config.ts";
import { canonicalOrigin } from "../lib/site-config.ts";
import { publishedRoutes } from "../lib/site-routes.ts";

export const dynamic = "force-static";

const homepageLanguages = {
  "pt-BR": `${canonicalOrigin}/`,
  en: `${canonicalOrigin}/en`,
  "x-default": `${canonicalOrigin}/`,
} as const;

const localizedHomepages: Record<Locale, string> = {
  "pt-BR": `${canonicalOrigin}/`,
  en: `${canonicalOrigin}/en`,
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = await publishedRoutes();
  const homepages: MetadataRoute.Sitemap = (["pt-BR", "en"] as const).map(
    (locale) => ({
      url: localizedHomepages[locale],
      alternates: { languages: homepageLanguages },
    }),
  );
  const otherRoutes = [...new Set(routes)]
    .filter((route) => route !== "/" && route !== "/en")
    .map((route) => ({ url: new URL(route, `${canonicalOrigin}/`).href }));

  return [...homepages, ...otherRoutes].sort((a, b) =>
    a.url.localeCompare(b.url),
  );
}
