import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mock, test } from "node:test";
import { runCredentialMonitor } from "../worker/src/credential-monitor.ts";
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

function memoryState(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    state: {
      get: async (key: string) => values.get(key) ?? null,
      put: async (key: string, value: string) => {
        values.set(key, value);
      },
      delete: async (key: string) => {
        values.delete(key);
      },
    },
  };
}

const monitorConfig = {
  ACTIVITY_MONITOR_ENABLED: "true",
  DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123456/token-secret",
};

test("only production binds KV and schedules the daily monitor", async () => {
  const config = JSON.parse(
    await readFile(
      new URL("../worker/wrangler.jsonc", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(config.env.production.vars.ACTIVITY_MONITOR_ENABLED, "true");
  assert.deepEqual(config.env.production.triggers.crons, ["0 6 * * *"]);
  assert.equal(
    config.env.production.kv_namespaces[0].binding,
    "ACTIVITY_MONITOR_STATE",
  );
  assert.ok(config.env.production.kv_namespaces[0].id);
  assert.equal(config.env.preview.vars.ACTIVITY_MONITOR_ENABLED, "false");
  assert.deepEqual(config.env.preview.triggers.crons, []);
  assert.deepEqual(config.env.preview.kv_namespaces, []);
});

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
  assert.equal(simkl?.url.searchParams.get("app-name"), "portfolio-v3");
  assert.equal(simkl?.url.searchParams.get("app-version"), "3.0.0");
  assert.equal(simkl?.init?.method, undefined);
  assert.equal(
    new Headers(simkl?.init?.headers).get("simkl-api-key"),
    "simkl-client",
  );
  assert.equal(
    new Headers(simkl?.init?.headers).get("User-Agent"),
    "portfolio-v3/3.0.0",
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

test("invalid credential alerts are deduplicated until a later valid probe", async () => {
  let invalid = true;
  const messages: string[] = [];
  const { state, values } = memoryState();
  const env = {
    ...monitorConfig,
    WAKATIME_API_KEY: "waka-secret",
    ACTIVITY_MONITOR_STATE: state,
  } as Env;
  const deps = dependencies((url, init) => {
    if (url.hostname === "discord.com") {
      assert.equal(url.searchParams.get("wait"), "true");
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.allowed_mentions, { parse: [] });
      messages.push(String(JSON.parse(String(init?.body)).content));
      return new Response(null, { status: 204 });
    }
    return invalid
      ? new Response("private provider error", { status: 401 })
      : { data: { id: "valid-user" } };
  });
  await runCredentialMonitor(env, deps);
  await runCredentialMonitor(env, deps);
  assert.equal(messages.length, 1);
  assert.match(messages[0] ?? "", /WakaTime/);
  assert.ok(!messages.join(" ").includes("private provider error"));
  assert.ok(!JSON.stringify([...values]).includes("waka-secret"));
  invalid = false;
  await runCredentialMonitor(env, deps);
  assert.equal(values.has("activity-monitor:credential:coding"), false);
  invalid = true;
  await runCredentialMonitor(env, deps);
  assert.equal(messages.length, 2);
});

test("invalid credential alerts remain separate for each configured provider", async () => {
  const messages: string[] = [];
  const { state } = memoryState();
  await runCredentialMonitor(
    {
      ...monitorConfig,
      WAKATIME_API_KEY: "waka",
      SIMKL_CLIENT_ID: "client",
      SIMKL_ACCESS_TOKEN: "token",
      STEAM_API_KEY: "steam",
      STEAM_ID: "76561198000000000",
      ACTIVITY_MONITOR_STATE: state,
    } as Env,
    dependencies((url, init) => {
      if (url.hostname === "discord.com") {
        messages.push(String(JSON.parse(String(init?.body)).content));
        return new Response(null, { status: 204 });
      }
      return new Response("invalid credentials", { status: 403 });
    }),
  );
  assert.equal(messages.length, 3);
  assert.ok(messages.some((message) => message.includes("WakaTime")));
  assert.ok(messages.some((message) => message.includes("Simkl")));
  assert.ok(messages.some((message) => message.includes("Steam")));
});

test("Spotify invalid_grant sends an immediate reauthorization alert once", async () => {
  const messages: string[] = [];
  const { state } = memoryState();
  const env = {
    ...monitorConfig,
    ...credentials,
    ACTIVITY_MONITOR_STATE: state,
  } as Env;
  const deps = dependencies((url, init) => {
    if (url.hostname === "discord.com") {
      messages.push(String(JSON.parse(String(init?.body)).content));
      return new Response(null, { status: 204 });
    }
    if (url.hostname === "accounts.spotify.com")
      return Response.json({ error: "invalid_grant" }, { status: 400 });
    return { data: { id: "valid" } };
  });
  await runCredentialMonitor(env, deps);
  await runCredentialMonitor(env, deps);
  assert.equal(messages.length, 1);
  assert.match(messages[0] ?? "", /Spotify/);
  assert.match(messages[0] ?? "", /reautoriz/i);
  assert.ok(!messages.join(" ").includes("spotify-refresh"));
});

test("Spotify age alerts use exact messages and deduplicate per timestamp and stage", async () => {
  const messages: string[] = [];
  const { state } = memoryState();
  const env = {
    ...monitorConfig,
    SPOTIFY_CLIENT_ID: "age-check",
    SPOTIFY_CLIENT_SECRET: "secret",
    SPOTIFY_REFRESH_TOKEN: "refresh",
    SPOTIFY_AUTHORIZED_AT: new Date(now - 173 * 86400000).toISOString(),
    ACTIVITY_MONITOR_STATE: state,
  } as Env;
  const deps = dependencies((url, init) => {
    if (url.hostname === "discord.com") {
      messages.push(String(JSON.parse(String(init?.body)).content));
      return new Response(null, { status: 204 });
    }
    return { access_token: "access", expires_in: 3600 };
  });
  await runCredentialMonitor(env, deps);
  await runCredentialMonitor(env, deps);
  assert.equal(messages.length, 1);
  assert.equal(messages[0], "⚠️ Spotify token expira em aproximadamente 7 dias");
  env.SPOTIFY_AUTHORIZED_AT = new Date(now - 180 * 86400000).toISOString();
  await runCredentialMonitor(env, deps);
  await runCredentialMonitor(env, deps);
  assert.equal(messages.length, 2);
  assert.equal(messages[1], "🚨 Spotify token deve estar expirado");
});

test("transient Spotify errors never produce a false expiration notice", async () => {
  const messages: string[] = [];
  const { state } = memoryState();
  await runCredentialMonitor(
    {
      ...monitorConfig,
      SPOTIFY_CLIENT_ID: "transient",
      SPOTIFY_CLIENT_SECRET: "secret",
      SPOTIFY_REFRESH_TOKEN: "refresh",
      SPOTIFY_AUTHORIZED_AT: new Date(now - 200 * 86400000).toISOString(),
      ACTIVITY_MONITOR_STATE: state,
    } as Env,
    dependencies((url, init) => {
      if (url.hostname === "discord.com") {
        messages.push(String(JSON.parse(String(init?.body)).content));
        return new Response(null, { status: 204 });
      }
      return new Response("temporary", { status: 503 });
    }),
  );
  assert.deepEqual(messages, []);
});

test("missing Spotify authorization date keeps credential checks enabled without age alerts", async () => {
  let spotifyChecks = 0;
  let discordCalls = 0;
  const { state } = memoryState();
  await runCredentialMonitor(
    {
      ...monitorConfig,
      SPOTIFY_CLIENT_ID: "no-date",
      SPOTIFY_CLIENT_SECRET: "secret",
      SPOTIFY_REFRESH_TOKEN: "refresh",
      ACTIVITY_MONITOR_STATE: state,
    } as Env,
    dependencies((url) => {
      if (url.hostname === "discord.com") discordCalls++;
      if (url.hostname === "accounts.spotify.com") {
        spotifyChecks++;
        return { access_token: "access", expires_in: 3600 };
      }
      return { data: { id: "valid" } };
    }),
  );
  assert.equal(spotifyChecks, 1);
  assert.equal(discordCalls, 0);
});

test("disabled or incomplete monitor configuration makes no network requests", async () => {
  let requests = 0;
  const deps = dependencies(() => {
    requests++;
    return { ok: true };
  });
  const { state } = memoryState();
  await runCredentialMonitor(
    { ...credentials, ACTIVITY_MONITOR_STATE: state },
    deps,
  );
  await runCredentialMonitor(
    {
      ...credentials,
      ACTIVITY_MONITOR_ENABLED: "true",
      ACTIVITY_MONITOR_STATE: state,
    },
    deps,
  );
  await runCredentialMonitor({ ...credentials, ...monitorConfig }, deps);
  await runCredentialMonitor(
    {
      ...credentials,
      ACTIVITY_MONITOR_ENABLED: "true",
      DISCORD_WEBHOOK_URL:
        "https://attacker.example/api/webhooks/123456/secret",
      ACTIVITY_MONITOR_STATE: state,
    },
    deps,
  );
  assert.equal(requests, 0);
});

test("failed Discord delivery does not mark an alert sent and retries later", async () => {
  let deliveryFails = true;
  let discordCalls = 0;
  const { state, values } = memoryState();
  const errorMock = mock.method(console, "error", () => {});
  try {
    await runCredentialMonitor(
      {
        ...monitorConfig,
        SIMKL_CLIENT_ID: "client",
        SIMKL_ACCESS_TOKEN: "token",
        ACTIVITY_MONITOR_STATE: state,
      } as Env,
      dependencies((url) => {
        if (url.hostname === "discord.com") {
          discordCalls++;
          return new Response(null, { status: deliveryFails ? 500 : 204 });
        }
        return new Response("unauthorized", { status: 401 });
      }),
    );
  } finally {
    errorMock.mock.restore();
  }
  assert.equal(values.size, 0);
  deliveryFails = false;
  await runCredentialMonitor(
    {
      ...monitorConfig,
      SIMKL_CLIENT_ID: "client",
      SIMKL_ACCESS_TOKEN: "token",
      ACTIVITY_MONITOR_STATE: state,
    } as Env,
    dependencies((url) => {
      if (url.hostname === "discord.com") {
        discordCalls++;
        return new Response(null, { status: 204 });
      }
      return new Response("unauthorized", { status: 401 });
    }),
  );
  assert.equal(discordCalls, 2);
  assert.equal(values.get("activity-monitor:credential:simkl"), "invalid");
});

test("KV errors never leak secrets or falsely record alert delivery", async () => {
  let discordCalls = 0;
  const state = {
    get: async () => {
      throw Error("private KV detail");
    },
    put: async () => {
      throw Error("private KV detail");
    },
    delete: async () => {
      throw Error("private KV detail");
    },
  };
  const errorMock = mock.method(console, "error", () => {});
  try {
    await runCredentialMonitor(
      {
        ...monitorConfig,
        SIMKL_CLIENT_ID: "client",
        SIMKL_ACCESS_TOKEN: "simkl-secret",
        ACTIVITY_MONITOR_STATE: state,
      } as Env,
      dependencies((url) => {
        if (url.hostname === "discord.com") discordCalls++;
        return new Response("private provider error", { status: 403 });
      }),
    );
  } finally {
    errorMock.mock.restore();
  }
  assert.equal(discordCalls, 0);
  assert.ok(!JSON.stringify(state).includes("simkl-secret"));
});

test("KV write and delete errors stay isolated from the monitor", async () => {
  const messages: string[] = [];
  const errorMock = mock.method(console, "error", () => {});
  try {
    const writeFailure = {
      get: async () => null,
      put: async () => {
        throw Error("write detail");
      },
      delete: async () => {},
    };
    await runCredentialMonitor(
      {
        ...monitorConfig,
        SIMKL_CLIENT_ID: "client",
        SIMKL_ACCESS_TOKEN: "token",
        ACTIVITY_MONITOR_STATE: writeFailure,
      } as Env,
      dependencies((url, init) => {
        if (url.hostname === "discord.com") {
          messages.push(String(JSON.parse(String(init?.body)).content));
          return new Response(null, { status: 204 });
        }
        return new Response("private error", { status: 403 });
      }),
    );
    const deleteFailure = {
      get: async () => "invalid",
      put: async () => {},
      delete: async () => {
        throw Error("delete detail");
      },
    };
    await runCredentialMonitor(
      {
        ...monitorConfig,
        SIMKL_CLIENT_ID: "client",
        SIMKL_ACCESS_TOKEN: "token",
        ACTIVITY_MONITOR_STATE: deleteFailure,
      } as Env,
      dependencies((url) =>
        url.hostname === "discord.com"
          ? new Response(null, { status: 204 })
          : { activities: {} },
      ),
    );
  } finally {
    errorMock.mock.restore();
  }
  assert.equal(messages.length, 1);
  assert.ok(!messages.join(" ").includes("private error"));
});
