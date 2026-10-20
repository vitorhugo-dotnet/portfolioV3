import assert from "node:assert/strict";
import { test } from "node:test";
import type { Env } from "../worker/src/types.ts";
import {
  getWakaTimeAccessToken,
  refreshWakaTimeAccessToken,
  WakaTimeTokenStore,
} from "../worker/src/wakatime-oauth.ts";

class MemoryStorage {
  values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }
  async put(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }
}

const now = Date.parse("2026-10-20T12:00:00Z");
const env = {
  WAKATIME_CLIENT_ID: "client-id",
  WAKATIME_CLIENT_SECRET: "client-secret",
  WAKATIME_REFRESH_TOKEN: "initial-refresh",
} satisfies Partial<Env>;

function deps(fetch: typeof globalThis.fetch) {
  return { fetch, now: () => now };
}

test("refreshes and persists the initial WakaTime token pair", async () => {
  const storage = new MemoryStorage();
  const calls: RequestInit[] = [];
  const accessToken = await refreshWakaTimeAccessToken(
    env,
    storage,
    deps(async (_input, init) => {
      calls.push(init ?? {});
      return Response.json({
        access_token: "access-1",
        refresh_token: "refresh-1",
        expires_in: 3600,
        token_type: "Bearer",
      });
    }),
  );
  assert.equal(accessToken, "access-1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.method, "POST");
  assert.equal(
    calls[0]?.headers && new Headers(calls[0].headers).get("Content-Type"),
    "application/x-www-form-urlencoded",
  );
  assert.deepEqual(await storage.get("wakatime-oauth"), {
    accessToken: "access-1",
    refreshToken: "refresh-1",
    expiresAt: now + 3_600_000,
  });
});

test("reuses an access token until its expiry safety window", async () => {
  const storage = new MemoryStorage();
  storage.values.set("wakatime-oauth", {
    accessToken: "cached-access",
    refreshToken: "initial-refresh",
    expiresAt: now + 60_001,
  });
  const token = await refreshWakaTimeAccessToken(env, storage, {
    ...deps(async () => {
      throw new Error("unexpected refresh");
    }),
  });
  assert.equal(token, "cached-access");
});

test("refreshes an access token inside the expiry safety window", async () => {
  const storage = new MemoryStorage();
  storage.values.set("wakatime-oauth", {
    accessToken: "nearly-expired",
    refreshToken: "initial-refresh",
    expiresAt: now + 60_000,
  });
  const token = await refreshWakaTimeAccessToken(
    env,
    storage,
    deps(async () =>
      Response.json({
        access_token: "renewed-access",
        refresh_token: "rotated-refresh",
        expires_in: 3600,
      }),
    ),
  );
  assert.equal(token, "renewed-access");
});

test("persists and uses a rotated refresh token on the next refresh", async () => {
  const storage = new MemoryStorage();
  const sentTokens: string[] = [];
  const fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    sentTokens.push(
      new URLSearchParams(String(init?.body)).get("refresh_token") ?? "",
    );
    const index = sentTokens.length;
    return Response.json({
      access_token: `access-${index}`,
      refresh_token: `refresh-${index}`,
      expires_in: 3600,
    });
  };
  await refreshWakaTimeAccessToken(env, storage, deps(fetch));
  await refreshWakaTimeAccessToken(
    { ...env, WAKATIME_REFRESH_TOKEN: undefined },
    storage,
    deps(fetch),
    { force: true },
  );
  assert.deepEqual(sentTokens, ["initial-refresh", "refresh-1"]);
});

test("forced refresh bypasses a cached access token", async () => {
  const storage = new MemoryStorage();
  storage.values.set("wakatime-oauth", {
    accessToken: "cached-access",
    refreshToken: "initial-refresh",
    expiresAt: now + 3600_000,
  });
  let refreshes = 0;
  const token = await refreshWakaTimeAccessToken(
    env,
    storage,
    deps(async () => {
      refreshes++;
      return Response.json({
        access_token: "forced-access",
        refresh_token: "rotated-refresh",
        expires_in: 3600,
      });
    }),
    { force: true },
  );
  assert.equal(token, "forced-access");
  assert.equal(refreshes, 1);
});

test("does not overwrite the stored token pair after malformed refresh", async () => {
  const storage = new MemoryStorage();
  const current = {
    accessToken: "expired-access",
    refreshToken: "stored-refresh",
    expiresAt: now - 1,
  };
  storage.values.set("wakatime-oauth", current);
  await assert.rejects(
    refreshWakaTimeAccessToken(
      { ...env, WAKATIME_REFRESH_TOKEN: undefined },
      storage,
      deps(async () => Response.json({ access_token: "partial" })),
      { force: true },
    ),
  );
  assert.deepEqual(await storage.get("wakatime-oauth"), current);
});

test("does not overwrite stored credentials when refresh requests fail", async () => {
  const storage = new MemoryStorage();
  const current = {
    accessToken: "expired-access",
    refreshToken: "stored-refresh",
    expiresAt: now - 1,
  };
  storage.values.set("wakatime-oauth", current);
  await assert.rejects(
    refreshWakaTimeAccessToken(
      { ...env, WAKATIME_REFRESH_TOKEN: undefined },
      storage,
      deps(async () => {
        throw new Error("private-refresh-token network text");
      }),
      { force: true },
    ),
  );
  assert.deepEqual(await storage.get("wakatime-oauth"), current);
});

test("serializes concurrent refreshes and keeps refresh tokens inside storage", async () => {
  const storage = new MemoryStorage();
  let lock: Promise<void> = Promise.resolve();
  const state = {
    storage,
    blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
      const current = lock.then(callback);
      lock = current.then(
        () => undefined,
        () => undefined,
      );
      return current;
    },
  };
  const requests: string[] = [];
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  globalThis.fetch = async (_input, init) => {
    requests.push(
      new URLSearchParams(String(init?.body)).get("refresh_token") ?? "",
    );
    await Promise.resolve();
    return Response.json({
      access_token: `access-${requests.length}`,
      refresh_token: `refresh-${requests.length}`,
      expires_in: 3600,
    });
  };
  Date.now = () => now;
  try {
    const store = new WakaTimeTokenStore(state, env);
    const [first, second] = await Promise.all([
      store.fetch(
        new Request("https://wakatime-token-store/access-token", {
          method: "POST",
          body: "{}",
        }),
      ),
      store.fetch(
        new Request("https://wakatime-token-store/access-token", {
          method: "POST",
          body: "{}",
        }),
      ),
    ]);
    assert.deepEqual(requests, ["initial-refresh"]);
    const firstPayload = await first.json();
    const secondPayload = await second.json();
    assert.deepEqual(firstPayload, { access_token: "access-1" });
    assert.deepEqual(secondPayload, { access_token: "access-1" });
    assert.equal(
      JSON.stringify([firstPayload, secondPayload]).includes("refresh-1"),
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test("returns unconfigured when WakaTime OAuth credentials are absent", async () => {
  await assert.rejects(
    refreshWakaTimeAccessToken(
      {},
      new MemoryStorage(),
      deps(async () => Response.json({})),
    ),
    (error: unknown) =>
      error instanceof Error && error.message === "unconfigured",
  );
});

test("returns an access token through the Worker Durable Object binding", async () => {
  const workerEnv: Env = {
    ...env,
    WAKATIME_TOKEN_STORE: {
      idFromName: (name) => name,
      get: () => ({
        fetch: async (request) => {
          assert.equal(
            new URL(request instanceof Request ? request.url : String(request))
              .pathname,
            "/access-token",
          );
          return Response.json({ access_token: "access-from-store" });
        },
      }),
    },
  };
  assert.equal(await getWakaTimeAccessToken(workerEnv), "access-from-store");
});
