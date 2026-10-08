import assert from "node:assert/strict";
import { test } from "node:test";
import robots from "../app/robots.ts";
import sitemap from "../app/sitemap.ts";
import { localizedHomepageMetadata } from "../lib/site-config.ts";

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
