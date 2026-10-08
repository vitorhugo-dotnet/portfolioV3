import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const origin = "https://hugodotnet.dev";
const expectedRoutes = [
  "index.html",
  "en.html",
  "hub.html",
  "sonicrelay/privacy-policy.html",
  "the-universe-decides/privacy-policy.html",
  "sitemap.xml",
  "sitemap-index.xml",
  "robots.txt",
  "sites/sitemap/hugojava.dev.xml",
  "sites/sitemap/hugodotnet.dev.xml",
];

async function readRequired(root: string, path: string): Promise<string> {
  try {
    return await readFile(join(root, path), "utf8");
  } catch {
    throw new Error(`Missing static export file: ${path}`);
  }
}

function oneTag(html: string, pattern: RegExp, description: string): string {
  const matches = html.match(pattern) ?? [];
  assert.equal(
    matches.length,
    1,
    `Expected one ${description}; got ${matches.length}`,
  );
  return matches[0];
}

function attribute(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1];
}

function verifyPage(
  html: string,
  {
    lang,
    canonical,
    locale,
    title,
  }: { lang: string; canonical: string; locale: string; title: string },
) {
  const htmlTag = oneTag(html, /<html\b[^>]*>/gi, "html element");
  assert.equal(
    attribute(htmlTag, "lang"),
    lang,
    `Incorrect lang for ${canonical}`,
  );
  const titleTag = oneTag(html, /<title\b[^>]*>[\s\S]*?<\/title>/gi, "title");
  assert.ok(
    titleTag.replace(/<[^>]+>/g, "").trim().length > 0,
    "Page title is empty",
  );
  assert.ok(
    titleTag.includes(title),
    `Expected localized title content: ${title}`,
  );
  oneTag(
    html,
    /<meta\b(?=[^>]*\bname=["']description["'])[^>]*>/gi,
    "description",
  );
  const canonicalTag = oneTag(
    html,
    /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi,
    "canonical",
  );
  assert.equal(attribute(canonicalTag, "href"), canonical);
  const ogLocale = oneTag(
    html,
    /<meta\b(?=[^>]*\bproperty=["']og:locale["'])[^>]*>/gi,
    "Open Graph locale",
  );
  assert.equal(attribute(ogLocale, "content"), locale);
  const robots =
    html.match(/<meta\b(?=[^>]*\bname=["']robots["'])[^>]*>/gi) ?? [];
  assert.ok(
    robots.every((tag) => !/noindex/i.test(tag)),
    "Page must remain indexable",
  );
  for (const [language, url] of [
    ["pt-BR", `${origin}/`],
    ["en", `${origin}/en`],
    ["x-default", `${origin}/`],
  ]) {
    const alternate = oneTag(
      html,
      new RegExp(
        `<link\\b(?=[^>]*\\brel=["']alternate["'])(?=[^>]*\\bhreflang=["']${language}["'])[^>]*>`,
        "gi",
      ),
      `${language} alternate`,
    );
    assert.equal(attribute(alternate, "href"), url);
  }
}

export async function verifyStaticExport(root: string): Promise<void> {
  const files = new Map<string, string>();
  for (const path of expectedRoutes)
    files.set(path, await readRequired(root, path));
  const file = (path: string) => {
    const contents = files.get(path);
    assert.ok(contents, `Missing verified file: ${path}`);
    return contents;
  };

  verifyPage(file("index.html"), {
    lang: "pt-BR",
    canonical: `${origin}/`,
    locale: "pt_BR",
    title: "Desenvolvedor",
  });
  verifyPage(file("en.html"), {
    lang: "en",
    canonical: `${origin}/en`,
    locale: "en_US",
    title: "Software",
  });

  const sitemap = file("sitemap.xml");
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (match) => match[1],
  );
  assert.equal(
    new Set(urls).size,
    urls.length,
    "Sitemap contains duplicate URLs",
  );
  for (const url of [
    `${origin}/`,
    `${origin}/en`,
    `${origin}/hub`,
    `${origin}/sonicrelay/privacy-policy`,
    `${origin}/the-universe-decides/privacy-policy`,
  ]) {
    assert.ok(urls.includes(url), `Sitemap is missing ${url}`);
  }
  for (const url of [`${origin}/`, `${origin}/en`]) {
    const entry = sitemap.match(
      new RegExp(
        `<url>(?:(?!<url>).)*?<loc>${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/loc>(?:(?!<url>).)*?<\\/url>`,
        "s",
      ),
    )?.[0];
    assert.ok(entry, `Missing localized sitemap entry ${url}`);
    for (const [language, alternateUrl] of [
      ["pt-BR", `${origin}/`],
      ["en", `${origin}/en`],
      ["x-default", `${origin}/`],
    ]) {
      assert.match(
        entry,
        new RegExp(
          `hreflang="${language}" href="${alternateUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
        ),
      );
    }
  }
  assert.match(
    file("robots.txt"),
    /Sitemap:\s*https:\/\/hugodotnet\.dev\/sitemap\.xml/i,
  );
  assert.match(file("robots.txt"), /Allow:\s*\//i);
  assert.match(file("sitemap-index.xml"), /<sitemapindex\b/i);
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  const root = process.argv[2];
  assert.ok(
    root,
    "Usage: node --experimental-strip-types scripts/verify-static-export.ts <out-dir>",
  );
  await verifyStaticExport(root);
  console.log(`Verified static export at ${root}`);
}
