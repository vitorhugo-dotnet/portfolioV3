import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLiveActivity } from "../lib/live-activity.ts";
import {
  fetchProviderJson,
  safeHttpsUrl,
  safeText,
} from "../worker/src/provider-http.ts";

test("public activity rejects invalid timestamps and provider states", () => {
  assert.equal(
    parseLiveActivity({ generatedAt: "bad", providerStates: {} }),
    null,
  );
  assert.equal(
    parseLiveActivity({
      generatedAt: new Date().toISOString(),
      providerStates: { coding: "bogus" },
    }),
    null,
  );
});
test("public text and URLs exclude credentials and unsafe hosts", () => {
  assert.equal(safeText("x".repeat(250))?.length, 200);
  assert.equal(safeHttpsUrl("javascript:alert(1)", ["example.com"]), undefined);
  assert.equal(
    safeHttpsUrl("https://user:pass@example.com", ["example.com"]),
    undefined,
  );
  assert.equal(
    safeHttpsUrl("https://example.com.evil.test", ["example.com"]),
    undefined,
  );
  assert.equal(
    safeHttpsUrl("https://example.com/image.png", ["example.com"]),
    "https://example.com/image.png",
  );
});
test("provider transport rejects malformed JSON and HTTP errors", async () => {
  for (const response of [
    new Response("bad"),
    new Response("{}", { status: 429 }),
  ]) {
    await assert.rejects(
      fetchProviderJson(
        new URL("https://example.com"),
        {},
        { fetch: async () => response, now: Date.now },
      ),
    );
  }
});
test("provider transport aborts a slow request", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const request = fetchProviderJson(
    new URL("https://example.com"),
    {},
    {
      now: Date.now,
      fetch: async (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    },
  );
  const rejected = assert.rejects(request);
  t.mock.timers.tick(5000);
  await rejected;
});
