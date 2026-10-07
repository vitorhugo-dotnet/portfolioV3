import assert from "node:assert/strict";
import { test } from "node:test";
import { sitemapIndexXml, sitemapXml } from "../lib/sitemap-xml.ts";

test("XML-escapes URLs including query separators so generated sitemaps remain parseable", () => {
  const urls = [
    "https://app.hugojava.dev/?lang=pt&source=github",
    "https://hugodotnet.dev/?q=<'\">&x=1",
  ];
  for (const xml of [sitemapXml(urls), sitemapIndexXml(urls)]) {
    assert.ok(xml.includes("?lang=pt&amp;source=github"));
    assert.ok(xml.includes("?q=&lt;&apos;&quot;&gt;&amp;x=1"));
    assert.equal(/&(?!amp;|lt;|gt;|apos;|quot;)/.test(xml), false);
  }
});
