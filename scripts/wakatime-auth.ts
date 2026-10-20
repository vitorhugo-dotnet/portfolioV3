import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const ISSUER = "https://wakatime.com";
const TOKEN_ENDPOINT = `${ISSUER}/oauth/token`;

export interface WakaTimeAuthorizationRequest {
  url: URL;
  state: string;
}

export function getWakaTimeRefreshSecretCommand(
  environment: "preview" | "production",
): string {
  return `npx wrangler secret put WAKATIME_REFRESH_TOKEN --config worker/wrangler.jsonc --env ${environment}`;
}

export function createWakaTimeAuthorizationRequest(
  clientId: string,
  redirectUri: string,
): WakaTimeAuthorizationRequest {
  const redirect = new URL(redirectUri);
  if (redirect.protocol !== "https:" || redirect.hash)
    throw new Error("redirect_uri_must_be_https_without_fragment");
  const state = randomBytes(24).toString("base64url");
  const url = new URL(`${ISSUER}/oauth/authorize`);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "read_summaries read_heartbeats",
    state,
  }).toString();
  return { url, state };
}

export function parseWakaTimeOAuthCallback(
  callbackUrl: string,
  redirectUri: string,
  expectedState: string,
): string {
  const callback = new URL(callbackUrl);
  const redirect = new URL(redirectUri);
  if (
    callback.origin !== redirect.origin ||
    callback.pathname !== redirect.pathname ||
    callback.hash
  )
    throw new Error("callback_redirect_mismatch");
  for (const [key, value] of redirect.searchParams) {
    if (callback.searchParams.get(key) !== value)
      throw new Error("callback_redirect_mismatch");
  }
  if (callback.searchParams.get("state") !== expectedState)
    throw new Error("callback_state_mismatch");
  if (callback.searchParams.has("error"))
    throw new Error("authorization_denied");
  const code = callback.searchParams.get("code");
  if (!code) throw new Error("authorization_code_missing");
  return code;
}

export async function exchangeWakaTimeAuthorizationCode(
  input: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    code: string;
  },
  fetcher: typeof fetch = fetch,
): Promise<{ refreshToken: string }> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    code: input.code,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetcher(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "portfolio-v3/3.0.0",
      },
      body,
      signal: controller.signal,
      redirect: "manual",
    });
  } catch {
    throw new Error("token_exchange_network_error");
  } finally {
    clearTimeout(timer);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`token_exchange_failed_${response.status}`);
  }
  if (!response.ok || !payload || typeof payload !== "object")
    throw new Error(`token_exchange_failed_${response.status}`);
  const tokens = payload as Record<string, unknown>;
  if (
    typeof tokens.access_token !== "string" ||
    !tokens.access_token ||
    typeof tokens.refresh_token !== "string" ||
    !tokens.refresh_token ||
    typeof tokens.expires_in !== "number" ||
    !Number.isFinite(tokens.expires_in) ||
    tokens.expires_in <= 0
  )
    throw new Error("token_response_missing_required_fields");
  return { refreshToken: tokens.refresh_token };
}

async function run(): Promise<void> {
  const clientId = process.env.WAKATIME_CLIENT_ID;
  const clientSecret = process.env.WAKATIME_CLIENT_SECRET;
  const redirectUri = process.env.WAKATIME_REDIRECT_URI;
  const environment = process.env.WAKATIME_ENV;
  if (!clientId || !clientSecret || !redirectUri || !environment)
    throw new Error(
      "Set WAKATIME_CLIENT_ID, WAKATIME_CLIENT_SECRET, WAKATIME_REDIRECT_URI, and WAKATIME_ENV in your local environment",
    );
  if (environment !== "preview" && environment !== "production")
    throw new Error("WAKATIME_ENV must be preview or production");
  const auth = createWakaTimeAuthorizationRequest(clientId, redirectUri);
  console.log("Open this authorization URL in your browser:\n");
  console.log(auth.url.href);
  console.log(
    "\nAfter approval, copy the complete callback URL from the browser and paste it below. The callback code is used only in this local process.\n",
  );
  const terminal = createInterface({ input: stdin, output: stdout });
  let callbackUrl: string;
  try {
    callbackUrl = await terminal.question("Callback URL: ");
  } finally {
    terminal.close();
  }
  const code = parseWakaTimeOAuthCallback(
    callbackUrl.trim(),
    redirectUri,
    auth.state,
  );
  const tokens = await exchangeWakaTimeAuthorizationCode({
    clientId,
    clientSecret,
    redirectUri,
    code,
  });
  console.log("\nSet this Worker secret in the selected environment:");
  console.log(getWakaTimeRefreshSecretCommand(environment));
  console.log(tokens.refreshToken);
  console.log(
    "\nKeep the refresh token private. It will be rotated and persisted by the Worker.",
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  run().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "WakaTime authorization failed",
    );
    process.exitCode = 1;
  });
}
