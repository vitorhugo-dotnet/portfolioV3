import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getSimklAccessToken,
  refreshSimklAccessToken,
  SimklTokenError,
} from "../worker/src/simkl-oauth.ts";
import type { Env } from "../worker/src/types.ts";

class MemoryStorage {
  values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }
  async put(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }
}

const now = Date.parse("2026-10-07T23:00:00Z");
const env = {
  SIMKL_CLIENT_ID: "simkl-client-v2",
  SIMKL_CLIENT_SECRET: "simkl-client-secret",
  SIMKL_REFRESH_TOKEN: "bootstrap-refresh-token",
} satisfies Partial<Env>;

test("AUTH V2 refresh persists its token pair and caches the access token", async () => {
  const storage = new MemoryStorage();
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  const accessToken = await refreshSimklAccessToken(env, storage, {
    fetch: async (input, init) => {
      calls.push({ url: new URL(String(input)), init });
      return Response.json({
        access_token: "new-access-token",
        refresh_token: "rotated-refresh-token",
        expires_in: 604800,
        token_type: "Bearer",
      });
    },
    now: () => now,
  });
  assert.equal(accessToken, "new-access-token");
  assert.equal(calls[0]?.url.href, "https://api.simkl.com/oauth2/token");
  assert.equal(calls[0]?.init?.method, "POST");
  const body = new URLSearchParams(String(calls[0]?.init?.body));
  assert.equal(body.get("grant_type"), "refresh_token");
  assert.equal(body.get("refresh_token"), "bootstrap-refresh-token");
  assert.equal(body.get("client_id"), "simkl-client-v2");
  assert.equal(body.get("client_secret"), "simkl-client-secret");
  assert.deepEqual(await storage.get("simkl-oauth"), {
    accessToken: "new-access-token",
    refreshToken: "rotated-refresh-token",
    expiresAt: now + 604800000,
  });
});

test("AUTH V2 refresh uses its stored refresh token after bootstrap", async () => {
  const storage = new MemoryStorage();
  storage.values.set("simkl-oauth", {
    accessToken: "expired-access-token",
    refreshToken: "latest-refresh-token",
    expiresAt: now - 1,
  });
  let sentRefreshToken = "";
  await refreshSimklAccessToken(env, storage, {
    fetch: async (_input, init) => {
      sentRefreshToken = new URLSearchParams(String(init?.body)).get(
        "refresh_token",
      ) as string;
      return Response.json({
        access_token: "next-access-token",
        refresh_token: "next-refresh-token",
        expires_in: 604800,
      });
    },
    now: () => now,
  });
  assert.equal(sentRefreshToken, "latest-refresh-token");
});

test("unexpired access token is reused until it is forced to refresh", async () => {
  const storage = new MemoryStorage();
  storage.values.set("simkl-oauth", {
    accessToken: "cached-access-token",
    refreshToken: "latest-refresh-token",
    expiresAt: now + 3600000,
  });
  let requests = 0;
  const token = await refreshSimklAccessToken(
    env,
    storage,
    {
      fetch: async () => {
        requests += 1;
        return Response.json({
          access_token: "forced-access-token",
          refresh_token: "forced-refresh-token",
          expires_in: 604800,
        });
      },
      now: () => now,
    },
    { force: true },
  );
  assert.equal(token, "forced-access-token");
  assert.equal(requests, 1);
});

test("invalid refresh grant is classified without exposing response text", async () => {
  await assert.rejects(
    refreshSimklAccessToken(env, new MemoryStorage(), {
      fetch: async () =>
        Response.json(
          { error: "invalid_grant", error_description: "private detail" },
          { status: 400 },
        ),
      now: () => now,
    }),
    (error: unknown) => {
      assert.ok(error instanceof SimklTokenError);
      assert.equal(error.code, "invalid_grant");
      assert.ok(!error.message.includes("private detail"));
      return true;
    },
  );
});

test("invalid client and transient failures leave stored tokens unchanged", async () => {
  for (const [status, code] of [
    [401, "invalid_client"],
    [503, "provider_error"],
  ] as const) {
    const storage = new MemoryStorage();
    const before = {
      accessToken: "old-access-token",
      refreshToken: "old-refresh-token",
      expiresAt: now - 1,
    };
    storage.values.set("simkl-oauth", before);
    await assert.rejects(
      refreshSimklAccessToken(env, storage, {
        fetch: async () => Response.json({ error: code }, { status }),
        now: () => now,
      }),
      SimklTokenError,
    );
    assert.deepEqual(await storage.get("simkl-oauth"), before);
  }
});

test("Worker gets the current token through the serialized durable object", async () => {
  const requests: string[] = [];
  const envWithStore: Env = {
    ...env,
    SIMKL_TOKEN_STORE: {
      idFromName: (name) => name,
      get: (id) => ({
        fetch: async (input) => {
          requests.push(
            `${String(id)}:${input instanceof Request ? input.url : String(input)}`,
          );
          return Response.json({ access_token: "durable-access-token" });
        },
      }),
    },
  };
  const token = await getSimklAccessToken(envWithStore);
  assert.equal(token, "durable-access-token");
  assert.deepEqual(requests, [
    "simkl-token-store:https://simkl-token-store/access-token",
  ]);
});

test("static access token remains available without a durable-object binding", async () => {
  assert.equal(
    await getSimklAccessToken({ SIMKL_ACCESS_TOKEN: "static-access-token" }),
    "static-access-token",
  );
});
