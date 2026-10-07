import { siteOrigins } from "./site-config.ts";
export function normalizeWebsite(value: string): string | null {
  const input = value.trim();
  if (!input) return null;
  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`,
    );
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export function isPortfolioWebsite(website: string): boolean {
  const normalized = normalizeWebsite(website);
  if (!normalized) return false;
  const host = new URL(normalized).hostname;
  return siteOrigins.some((origin) => {
    const root = new URL(origin).hostname;
    return host === root || host.endsWith(`.${root}`);
  });
}
export function sitemapGroups(
  paths: readonly string[],
  websites: readonly string[],
): Record<string, string[]> {
  const groups = new Map<string, Set<string>>();
  for (const origin of siteOrigins)
    groups.set(
      new URL(origin).hostname,
      new Set(paths.map((path) => new URL(path, origin).href)),
    );
  for (const website of websites) {
    const normalized = normalizeWebsite(website);
    if (!normalized || !isPortfolioWebsite(normalized)) continue;
    const url = new URL(normalized);
    url.protocol = "https:";
    url.hash = "";
    const urls = groups.get(url.host) || new Set<string>();
    urls.add(url.href);
    groups.set(url.host, urls);
  }
  return Object.fromEntries(
    [...groups]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([host, urls]) => [host, [...urls].sort()]),
  );
}
