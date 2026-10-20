import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createWakaTimeAuthorizationRequest,
  exchangeWakaTimeAuthorizationCode,
  getWakaTimeRefreshSecretCommand,
  parseWakaTimeOAuthCallback,
} from "../scripts/wakatime-auth.ts";

const redirectUri = "https://wakatime.com/oauth/test";

test("refresh-token setup command targets the selected Worker environment", () => {
  assert.equal(
    getWakaTimeRefreshSecretCommand("preview"),
    "npx wrangler secret put WAKATIME_REFRESH_TOKEN --config worker/wrangler.jsonc --env preview",
  );
  assert.equal(
    getWakaTimeRefreshSecretCommand("production"),
    "npx wrangler secret put WAKATIME_REFRESH_TOKEN --config worker/wrangler.jsonc --env production",
  );
});

test("authorization request asks only for summary and heartbeat reads", () => {
  const { url, state } = createWakaTimeAuthorizationRequest(
    "client-id",
    redirectUri,
  );
  assert.equal(url.origin, "https://wakatime.com");
  assert.equal(url.pathname, "/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "client-id");
  assert.equal(url.searchParams.get("redirect_uri"), redirectUri);
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), "read_summaries read_heartbeats");
  assert.equal(url.searchParams.get("state"), state);
  assert.ok(state.length >= 32);
});

test("callback parsing validates exact redirect and state and returns its code", () => {
  assert.equal(
    parseWakaTimeOAuthCallback(
      `${redirectUri}?code=one-time-code&state=expected`,
      redirectUri,
      "expected",
    ),
    "one-time-code",
  );
  for (const callback of [
    "https://evil.example/oauth/test?code=secret&state=expected",
    `${redirectUri}/extra?code=secret&state=expected`,
    `${redirectUri}?code=secret&state=wrong`,
    `${redirectUri}?error=access_denied&state=expected`,
    `${redirectUri}?state=expected`,
  ])
    assert.throws(() =>
      parseWakaTimeOAuthCallback(callback, redirectUri, "expected"),
    );
});

test("authorization-code exchange sends OAuth fields and returns only the refresh token", async () => {
  let requestUrl = "";
  let requestBody = new URLSearchParams();
  const result = await exchangeWakaTimeAuthorizationCode(
    {
      clientId: "client-id",
      clientSecret: "private-client-secret",
      redirectUri,
      code: "one-time-code",
    },
    async (input, init) => {
      requestUrl = String(input);
      requestBody = new URLSearchParams(String(init?.body));
      return Response.json({
        access_token: "private-access-token",
        refresh_token: "private-refresh-token",
        expires_in: 3600,
      });
    },
  );
  assert.equal(requestUrl, "https://wakatime.com/oauth/token");
  assert.equal(requestBody.get("client_id"), "client-id");
  assert.equal(requestBody.get("client_secret"), "private-client-secret");
  assert.equal(requestBody.get("code"), "one-time-code");
  assert.equal(requestBody.get("redirect_uri"), redirectUri);
  assert.equal(requestBody.get("grant_type"), "authorization_code");
  assert.deepEqual(result, { refreshToken: "private-refresh-token" });
  assert.ok(!JSON.stringify(result).includes("private-access-token"));
});

test("authorization-code exchange rejects malformed responses without exposing secrets", async () => {
  await assert.rejects(
    exchangeWakaTimeAuthorizationCode(
      {
        clientId: "client-id",
        clientSecret: "private-client-secret",
        redirectUri,
        code: "one-time-code",
      },
      async () =>
        Response.json({
          access_token: "private-access-token",
          error_description: "private-client-secret private-refresh-token",
        }),
    ),
    (error: unknown) =>
      error instanceof Error &&
      !error.message.includes("private-client-secret") &&
      !error.message.includes("private-refresh-token"),
  );
});
