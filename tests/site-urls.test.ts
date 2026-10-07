import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isPortfolioWebsite,
  normalizeWebsite,
  sitemapGroups,
} from "../lib/site-urls.ts";

test("accepts public HTTP websites and rejects unsafe or malformed links", () => {
  assert.equal(normalizeWebsite("example.com/app"), "https://example.com/app");
  assert.equal(
    normalizeWebsite(" https://example.com/ "),
    "https://example.com/",
  );
  for (const value of [
    "",
    "javascript:alert(1)",
    "data:text/html,x",
    "ftp://example.com",
    "https://user:pass@example.com",
    "not a URL",
  ]) {
    assert.equal(normalizeWebsite(value), null);
  }
});

test("groups both root domains and their subdomains while excluding unrelated websites", () => {
  const result = sitemapGroups(
    ["/", "/hub"],
    [
      "https://app.hugojava.dev/docs#top",
      "https://hugodotnet.dev/product",
      "https://other.dev/app",
      "https://hugojava.dev.evil.test/app",
      "https://evilhugojava.dev",
    ],
  );
  assert.deepEqual(result["hugojava.dev"], [
    "https://hugojava.dev/",
    "https://hugojava.dev/hub",
  ]);
  assert.deepEqual(result["hugodotnet.dev"], [
    "https://hugodotnet.dev/",
    "https://hugodotnet.dev/hub",
    "https://hugodotnet.dev/product",
  ]);
  assert.deepEqual(result["app.hugojava.dev"], [
    "https://app.hugojava.dev/docs",
  ]);
  assert.equal(Object.keys(result).length, 3);
  assert.equal(isPortfolioWebsite("https://other.dev"), false);
  assert.equal(isPortfolioWebsite("https://nested.app.hugodotnet.dev"), true);
});
