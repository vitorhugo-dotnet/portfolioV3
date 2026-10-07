import assert from "node:assert/strict";
import { test } from "node:test";
import { probeActivityCredentials } from "../worker/src/credential-probes.ts";
import type { Env, ProviderDependencies } from "../worker/src/types.ts";

const now = Date.parse("2026-10-07T12:00:00Z");
type RequestHandler = (
  url: URL,
  init?: RequestInit,
) => Response | unknown | Promise<Response | unknown>;

function dependencies(handler: RequestHandler): ProviderDependencies {
  return {
    now: () => now,
    fetch: async (input, init) => {
      const result = await handler(new URL(String(input)), init);
      return result instanceof Response ? result : Response.json(result);
    },
  };
}

const credentials: Env = {
  WAKATIME_API_KEY: "waka-secret",
  SPOTIFY_CLIENT_ID: "spotify-client",
  SPOTIFY_CLIENT_SECRET: "spotify-secret",
  SPOTIFY_REFRESH_TOKEN: "spotify-refresh",
  SIMKL_CLIENT_ID: "simkl-client",
  SIMKL_ACCESS_TOKEN: "simkl-secret",
  STEAM_API_KEY: "steam-secret",
  STEAM_ID: "76561198000000000",
};

test("credential probes authenticate to each official provider using minimal endpoints", async () => {
  const requests: Array<{ url: URL; init?: RequestInit }> = [];
  const result = await probeActivityCredentials(
    credentials,
    dependencies((url, init) => {
      requests.push({ url, init });
      if (url.hostname === "accounts.spotify.com")
        return { access_token: "private-access-token", expires_in: 3600 };
      if (url.hostname === "api.wakatime.com") return { data: { id: "1" } };
      if (url.hostname === "api.simkl.com") return { activities: {} };
      return { response: { players: [] } };
    }),
  );
  assert.deepEqual(result, {
    coding: { state: "valid" },
    spotify: { state: "valid" },
    simkl: { state: "valid" },
    steam: { state: "valid" },
  });
  const waka = requests.find(
    (request) => request.url.hostname === "api.wakatime.com",
  );
  assert.equal(waka?.url.pathname, "/api/v1/users/current");
  assert.equal(
    new Headers(waka?.init?.headers).get("Authorization"),
    `Basic ${btoa("waka-secret")}`,
  );
  const simkl = requests.find(
    (request) => request.url.hostname === "api.simkl.com",
  );
  assert.equal(simkl?.url.pathname, "/sync/activities");
  assert.equal(simkl?.init?.method, "POST");
  assert.equal(
    new Headers(simkl?.init?.headers).get("simkl-api-key"),
    "simkl-client",
  );
  const steam = requests.find(
    (request) => request.url.hostname === "api.steampowered.com",
  );
  assert.equal(steam?.url.pathname, "/ISteamUser/GetPlayerSummaries/v2/");
  assert.equal(steam?.url.searchParams.get("key"), "steam-secret");
  assert.equal(steam?.url.searchParams.get("steamids"), "76561198000000000");
  assert.ok(!JSON.stringify(result).includes("secret"));
  assert.ok(!JSON.stringify(result).includes("private-access-token"));
});

test("WakaTime, Simkl, and Steam classify unauthorized responses as invalid", async () => {
  for (const [provider, status] of [
    ["coding", 401],
    ["coding", 403],
    ["simkl", 401],
    ["simkl", 403],
    ["steam", 401],
    ["steam", 403],
  ] as const) {
    const env: Env =
      provider === "coding"
        ? { WAKATIME_API_KEY: "key" }
        : provider === "simkl"
          ? { SIMKL_CLIENT_ID: "client", SIMKL_ACCESS_TOKEN: "token" }
          : { STEAM_API_KEY: "key", STEAM_ID: "76561198000000000" };
    const result = await probeActivityCredentials(
      env,
      dependencies(() => new Response("private-error-sentinel", { status })),
    );
    assert.equal(result[provider].state, "invalid");
    assert.equal(result[provider].reason, "unauthorized");
    assert.ok(!JSON.stringify(result).includes("private-error-sentinel"));
  }
});

test("Spotify invalid_grant, invalid_client, and 401 are invalid credentials", async () => {
  for (const [response, reason] of [
    [
      Response.json({ error: "invalid_grant" }, { status: 400 }),
      "invalid_token",
    ],
    [
      Response.json({ error: "invalid_client" }, { status: 400 }),
      "invalid_client",
    ],
    [
      Response.json({ error: "unauthorized" }, { status: 401 }),
      "invalid_client",
    ],
  ] as const) {
    const result = await probeActivityCredentials(
      { ...credentials, WAKATIME_API_KEY: undefined },
      dependencies(() => response),
    );
    assert.deepEqual(result.spotify, { state: "invalid", reason });
  }
});

test("transient and ambiguous provider failures never become invalid credentials", async () => {
  for (const response of [
    new Response("rate limited", { status: 429 }),
    new Response("server error", { status: 503 }),
    new Response("bad request", { status: 400 }),
    new Response("{", { status: 200 }),
  ]) {
    const result = await probeActivityCredentials(
      { WAKATIME_API_KEY: "key" },
      dependencies(() => response),
    );
    assert.deepEqual(result.coding, {
      state: "transient",
      reason: "provider_error",
    });
  }
  const networkError = await probeActivityCredentials(
    { SIMKL_CLIENT_ID: "client", SIMKL_ACCESS_TOKEN: "token" },
    dependencies(() => {
      throw Error("private network details");
    }),
  );
  assert.deepEqual(networkError.simkl, {
    state: "transient",
    reason: "provider_error",
  });
  assert.ok(!JSON.stringify(networkError).includes("private network details"));
  const timeout = await probeActivityCredentials(
    { WAKATIME_API_KEY: "key" },
    dependencies((_url, init) => {
      assert.ok(init?.signal);
      throw new DOMException("Aborted", "AbortError");
    }),
  );
  assert.deepEqual(timeout.coding, {
    state: "transient",
    reason: "provider_error",
  });
});

test("missing credentials skip only their provider and do not make calls", async () => {
  let requests = 0;
  const result = await probeActivityCredentials(
    {
      WAKATIME_API_KEY: "key",
      SIMKL_CLIENT_ID: "client-without-token",
    },
    dependencies(() => {
      requests++;
      return { data: { id: "1" } };
    }),
  );
  assert.deepEqual(result, {
    coding: { state: "valid" },
    spotify: { state: "unconfigured" },
    simkl: { state: "unconfigured" },
    steam: { state: "unconfigured" },
  });
  assert.equal(requests, 1);
});
