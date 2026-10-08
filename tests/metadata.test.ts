import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import robots from "../app/robots.ts";
import sitemap from "../app/sitemap.ts";
import { localizedHomepageMetadata } from "../lib/site-config.ts";
import { verifyStaticExport } from "../scripts/verify-static-export.ts";

async function makeExportFixture() {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-export-"));
  const html = (
    lang: string,
    title: string,
    canonical: string,
    locale: string,
  ) =>
    `<!doctype html><html lang="${lang}"><head><title>${title}</title><meta name="description" content="${title} description"><link rel="canonical" href="${canonical}"><link rel="alternate" hreflang="pt-BR" href="https://hugodotnet.dev/"><link rel="alternate" hreflang="en" href="https://hugodotnet.dev/en"><link rel="alternate" hreflang="x-default" href="https://hugodotnet.dev/"><meta property="og:locale" content="${locale}"></head><body></body></html>`;
  const files: Record<string, string> = {
    "index.html": html(
      "pt-BR",
      "Desenvolvedor de Software",
      "https://hugodotnet.dev/",
      "pt_BR",
    ),
    "en.html": html(
      "en",
      "Software Engineer",
      "https://hugodotnet.dev/en",
      "en_US",
    ),
    "hub.html": "<html><body>hub</body></html>",
    "sonicrelay/privacy-policy.html": "<html><body>privacy</body></html>",
    "the-universe-decides/privacy-policy.html":
      "<html><body>privacy</body></html>",
    "sitemap.xml": `<?xml version="1.0"?><urlset><url><loc>https://hugodotnet.dev/</loc><xhtml:link rel="alternate" hreflang="pt-BR" href="https://hugodotnet.dev/"/><xhtml:link rel="alternate" hreflang="en" href="https://hugodotnet.dev/en"/><xhtml:link rel="alternate" hreflang="x-default" href="https://hugodotnet.dev/"/></url><url><loc>https://hugodotnet.dev/en</loc><xhtml:link rel="alternate" hreflang="pt-BR" href="https://hugodotnet.dev/"/><xhtml:link rel="alternate" hreflang="en" href="https://hugodotnet.dev/en"/><xhtml:link rel="alternate" hreflang="x-default" href="https://hugodotnet.dev/"/></url><url><loc>https://hugodotnet.dev/hub</loc></url><url><loc>https://hugodotnet.dev/sonicrelay/privacy-policy</loc></url><url><loc>https://hugodotnet.dev/the-universe-decides/privacy-policy</loc></url></urlset>`,
    "sitemap-index.xml": "<sitemapindex></sitemapindex>",
    "robots.txt":
      "User-agent: *\nAllow: /\n\nSitemap: https://hugodotnet.dev/sitemap.xml",
    "sites/sitemap/hugojava.dev.xml": "<urlset></urlset>",
    "sites/sitemap/hugodotnet.dev.xml": "<urlset></urlset>",
  };
  for (const [path, contents] of Object.entries(files)) {
    const fullPath = join(directory, path);
    await mkdir(join(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, contents);
  }
  return directory;
}

test("static export verifier accepts complete localized artifacts", async () => {
  const directory = await makeExportFixture();
  try {
    await verifyStaticExport(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("static export verifier rejects incorrect language and duplicate canonicals", async () => {
  const directory = await makeExportFixture();
  try {
    const englishPath = join(directory, "en.html");
    const original = await readFile(englishPath, "utf8");
    await writeFile(englishPath, original.replace('lang="en"', 'lang="pt-BR"'));
    await assert.rejects(verifyStaticExport(directory), /lang/);
    await writeFile(
      englishPath,
      `${original}<link rel="canonical" href="https://hugodotnet.dev/en">`,
    );
    await assert.rejects(verifyStaticExport(directory), /canonical/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("localized homepage metadata has self canonical and reciprocal hreflang", () => {
  const portuguese = localizedHomepageMetadata("pt-BR");
  const english = localizedHomepageMetadata("en");
  const languages = {
    "pt-BR": "https://hugodotnet.dev/",
    en: "https://hugodotnet.dev/en",
    "x-default": "https://hugodotnet.dev/",
  };

  assert.equal(portuguese.alternates?.canonical, languages["pt-BR"]);
  assert.deepEqual(portuguese.alternates?.languages, languages);
  assert.equal(english.alternates?.canonical, languages.en);
  assert.deepEqual(english.alternates?.languages, languages);
  assert.equal(portuguese.openGraph?.locale, "pt_BR");
  assert.equal(english.openGraph?.locale, "en_US");
  assert.deepEqual(portuguese.robots, { index: true, follow: true });
  assert.deepEqual(english.robots, { index: true, follow: true });
  assert.notEqual(portuguese.title, english.title);
  assert.notEqual(portuguese.description, english.description);
  assert.equal(portuguese.openGraph?.url, languages["pt-BR"]);
  assert.equal(english.openGraph?.url, languages.en);
});

test("sitemap includes each locale once with x-default alternatives", async () => {
  const entries = await sitemap();
  const urls = entries.map((entry) => entry.url);
  const portuguese = entries.find(
    (entry) => entry.url === "https://hugodotnet.dev/",
  );
  const english = entries.find(
    (entry) => entry.url === "https://hugodotnet.dev/en",
  );
  const languages = {
    "pt-BR": "https://hugodotnet.dev/",
    en: "https://hugodotnet.dev/en",
    "x-default": "https://hugodotnet.dev/",
  };

  assert.equal(new Set(urls).size, urls.length);
  assert.ok(portuguese);
  assert.ok(english);
  assert.deepEqual(portuguese.alternates?.languages, languages);
  assert.deepEqual(english.alternates?.languages, languages);
  assert.equal(
    entries.some((entry) => "lastModified" in entry),
    false,
  );
  assert.ok(urls.includes("https://hugodotnet.dev/hub"));
  assert.ok(urls.includes("https://hugodotnet.dev/sonicrelay/privacy-policy"));
  assert.ok(
    urls.includes("https://hugodotnet.dev/the-universe-decides/privacy-policy"),
  );
});

test("robots allows public routes and references the primary sitemap", () => {
  const result = robots();
  assert.deepEqual(result.rules, { userAgent: "*", allow: "/" });
  assert.equal(result.sitemap, "https://hugodotnet.dev/sitemap.xml");
});
