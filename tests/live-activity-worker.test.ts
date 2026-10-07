import assert from "node:assert/strict";
import { test } from "node:test";
import type { LiveActivityResponse } from "../lib/live-activity.ts";
import worker, { createActivityHandler } from "../worker/src/index.ts";
import type { Env, ScheduledControllerLike } from "../worker/src/types.ts";

test("worker validates routes methods and exact CORS origins", async () => {
  const handler = createActivityHandler({
    fetch,
    now: Date.now,
    collect: async () => ({
      generatedAt: new Date().toISOString(),
      providerStates: {
        coding: "empty",
        spotify: "empty",
        simkl: "empty",
        steam: "empty",
      },
    }),
    cache: { match: async () => undefined, put: async () => {} },
  });
  const env = {
    ALLOWED_ORIGINS: "https://hugojava.dev,https://hugodotnet.dev",
    PAGES_PROJECT: "portfolio",
  };
  const ctx = { waitUntil: (_promise: Promise<unknown>) => {} };
  assert.equal(
    (await handler(new Request("https://worker.test/other"), env, ctx)).status,
    404,
  );
  const post = await handler(
    new Request("https://worker.test/api/activity", { method: "POST" }),
    env,
    ctx,
  );
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("Allow"), "GET, OPTIONS");
  for (const [origin, allowed] of [
    ["https://hugojava.dev", true],
    ["https://pr-2.portfolio.pages.dev", true],
    ["https://portfolio.pages.dev.evil.test", false],
    ["https://other.pages.dev", false],
    ["http://localhost:3000", false],
    ["https://hugojava.dev:8443", false],
  ]) {
    const response = await handler(
      new Request("https://worker.test/api/activity", {
        headers: { Origin: String(origin) },
      }),
      env,
      ctx,
    );
    assert.equal(
      response.headers.get("Access-Control-Allow-Origin"),
      allowed ? origin : null,
    );
    assert.equal(
      response.headers.get("Access-Control-Allow-Credentials"),
      null,
    );
  }
  const options = await handler(
    new Request("https://worker.test/api/activity", {
      method: "OPTIONS",
      headers: { Origin: "https://hugojava.dev" },
    }),
    env,
    ctx,
  );
  assert.equal(options.status, 204);
  const local = await handler(
    new Request("https://worker.test/api/activity", {
      headers: { Origin: "http://localhost:3000" },
    }),
    { ...env, DEVELOPMENT: "true" },
    ctx,
  );
  assert.equal(
    local.headers.get("Access-Control-Allow-Origin"),
    "http://localhost:3000",
  );
});
test("worker caches sanitized payload for 60 seconds without caching CORS", async () => {
  let now = Date.parse("2026-10-07T12:00:00Z");
  let calls = 0;
  let cached: Response | undefined;
  let storedAt = 0;
  const writes: Promise<unknown>[] = [];
  const handler = createActivityHandler({
    fetch,
    now: () => now,
    collect: async () => {
      calls++;
      return {
        generatedAt: new Date(now).toISOString(),
        providerStates: {
          coding: "available",
          spotify: "unavailable",
          simkl: "empty",
          steam: "empty",
        },
        coding: { status: "idle" },
      } satisfies LiveActivityResponse;
    },
    cache: {
      match: async () => (now - storedAt < 60000 ? cached?.clone() : undefined),
      put: async (_key, response) => {
        cached = response.clone();
        storedAt = now;
      },
    },
  });
  const ctx = {
    waitUntil: (p: Promise<unknown>) => {
      writes.push(p);
    },
  };
  const env = {
    ALLOWED_ORIGINS: "https://hugojava.dev,https://hugodotnet.dev",
  };
  const first = await handler(
    new Request("https://worker.test/api/activity?ignored=1", {
      headers: { Origin: "https://hugojava.dev" },
    }),
    env,
    ctx,
  );
  await Promise.all(writes);
  now += 30000;
  const second = await handler(
    new Request("https://worker.test/api/activity", {
      headers: { Origin: "https://hugodotnet.dev" },
    }),
    env,
    ctx,
  );
  assert.equal(calls, 1);
  assert.equal(
    (await first.json()).generatedAt,
    (await second.json()).generatedAt,
  );
  assert.equal(cached?.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal(cached?.headers.get("Cache-Control"), "public, max-age=60");
  assert.equal(
    second.headers.get("Access-Control-Allow-Origin"),
    "https://hugodotnet.dev",
  );
  now += 31000;
  await handler(new Request("https://worker.test/api/activity"), env, ctx);
  assert.equal(calls, 2);
});
test("cache errors do not take down the endpoint", async () => {
  const pending: Promise<unknown>[] = [];
  const handler = createActivityHandler({
    fetch,
    now: Date.now,
    collect: async () => ({
      generatedAt: new Date().toISOString(),
      providerStates: {
        coding: "empty",
        spotify: "empty",
        simkl: "empty",
        steam: "empty",
      },
    }),
    cache: {
      match: async () => {
        throw Error("cache read");
      },
      put: async () => {
        throw Error("cache write");
      },
    },
  });
  const response = await handler(
    new Request("https://worker.test/api/activity"),
    {},
    {
      waitUntil: (p) => {
        pending.push(p);
      },
    },
  );
  await Promise.all(pending);
  assert.equal(response.status, 200);
});

test("scheduled worker runs credential monitoring with Worker bindings and clock", async () => {
  type ScheduledWorker = typeof worker & {
    scheduled?: (
      controller: ScheduledControllerLike,
      env: Env,
      ctx: { waitUntil(promise: Promise<unknown>): void },
    ) => void;
  };
  const scheduledWorker = worker as ScheduledWorker;
  assert.equal(typeof scheduledWorker.scheduled, "function");
  if (!scheduledWorker.scheduled) return;

  const now = Date.parse("2026-10-07T12:00:00Z");
  const currentDateNow = Date.now;
  Date.now = () => now;
  const stored = new Map<string, string>();
  const state = {
    get: async (key: string) => stored.get(key) ?? null,
    put: async (key: string, value: string) => {
      stored.set(key, value);
    },
    delete: async (key: string) => {
      stored.delete(key);
    },
  };
  const calls: URL[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    if (url.hostname === "accounts.spotify.com")
      return Response.json({ access_token: "token", expires_in: 3600 });
    if (url.hostname === "discord.com")
      return new Response(null, { status: 204 });
    return Response.json({ data: { id: "valid" } });
  }) as typeof fetch;
  const env: Env = {
    ACTIVITY_MONITOR_ENABLED: "true",
    ACTIVITY_MONITOR_STATE: state,
    DISCORD_WEBHOOK_URL:
      "https://discord.com/api/webhooks/123456/webhook-token",
    SPOTIFY_CLIENT_ID: "client",
    SPOTIFY_CLIENT_SECRET: "secret",
    SPOTIFY_REFRESH_TOKEN: "refresh",
    SPOTIFY_AUTHORIZED_AT: new Date(now - 173 * 86400000).toISOString(),
  };
  const pending: Promise<unknown>[] = [];
  try {
    scheduledWorker.scheduled(
      { scheduledTime: now, cron: "0 6 * * *", noRetry: () => {} },
      env,
      { waitUntil: (promise) => pending.push(promise) },
    );
    await Promise.all(pending);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = currentDateNow;
  }
  assert.ok(calls.some((url) => url.hostname === "accounts.spotify.com"));
  assert.ok(calls.some((url) => url.hostname === "discord.com"));
  assert.equal(
    stored.get("activity-monitor:spotify-age"),
    `${env.SPOTIFY_AUTHORIZED_AT}:warning`,
  );
});
