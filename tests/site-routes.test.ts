import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { publishedRoutes } from "../lib/site-routes.ts";

test("discovers locale routes and keeps existing public paths", async () => {
  const routes = await publishedRoutes();
  for (const route of [
    "/",
    "/en",
    "/hub",
    "/sonicrelay/privacy-policy",
    "/the-universe-decides/privacy-policy",
  ]) {
    assert.equal(routes.filter((candidate) => candidate === route).length, 1);
  }
});

test("discovers static App Router pages including route groups, excluding private and dynamic routes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-routes-"));
  try {
    for (const path of [
      "",
      "hub",
      "(docs)/privacy",
      "_private",
      "[slug]",
      "@modal",
    ]) {
      await mkdir(join(directory, path), { recursive: true });
      await writeFile(
        join(directory, path, "page.tsx"),
        "export default function Page() {}",
      );
    }
    assert.deepEqual(await publishedRoutes(directory), [
      "/",
      "/hub",
      "/privacy",
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
