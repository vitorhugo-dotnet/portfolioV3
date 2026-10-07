import { createHash, randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const ISSUER = "https://simkl.com";
const TOKEN_ENDPOINT = "https://api.simkl.com/oauth2/token";

export interface SimklPkceRequest {
  url: URL;
  codeVerifier: string;
  state: string;
}

export function createSimklPkceRequest(
  clientId: string,
  redirectUri: string,
): SimklPkceRequest {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const state = randomBytes(24).toString("base64url");
  const url = new URL(`${ISSUER}/oauth2/authorize`);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "media:read",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  }).toString();
  return { url, codeVerifier, state };
}

export function parseSimklOAuthCallback(
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
  if (callback.searchParams.get("iss") !== ISSUER)
    throw new Error("callback_issuer_mismatch");
  if (callback.searchParams.get("state") !== expectedState)
    throw new Error("callback_state_mismatch");
  if (callback.searchParams.has("error"))
    throw new Error("authorization_denied");
  const code = callback.searchParams.get("code");
  if (!code) throw new Error("authorization_code_missing");
  return code;
}

async function run(): Promise<void> {
  const clientId = process.env.SIMKL_CLIENT_ID;
  const clientSecret = process.env.SIMKL_CLIENT_SECRET;
  const redirectUri = process.env.SIMKL_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri)
    throw new Error(
      "Set SIMKL_CLIENT_ID, SIMKL_CLIENT_SECRET, and SIMKL_REDIRECT_URI in your local environment",
    );
  const redirect = new URL(redirectUri);
  if (redirect.hash) throw new Error("redirect_uri_must_not_have_fragment");

  const auth = createSimklPkceRequest(clientId, redirectUri);
  console.log("Open this authorization URL in your browser:\n");
  console.log(auth.url.href);
  console.log(
    "\nAfter approval, copy the complete callback URL from the browser and paste it below. The verifier remains in this local process.\n",
  );
  const terminal = createInterface({ input: stdin, output: stdout });
  let callbackUrl: string;
  try {
    callbackUrl = await terminal.question("Callback URL: ");
  } finally {
    terminal.close();
  }
  const code = parseSimklOAuthCallback(
    callbackUrl.trim(),
    redirectUri,
    auth.state,
  );
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: auth.codeVerifier,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "portfolio-v3/3.0.0",
      },
      body,
      signal: controller.signal,
      redirect: "manual",
    });
  } finally {
    clearTimeout(timer);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`token_exchange_failed_${response.status}`);
  }
  if (!response.ok || !payload || typeof payload !== "object") {
    const code =
      payload &&
      typeof payload === "object" &&
      typeof (payload as Record<string, unknown>).error === "string"
        ? (payload as Record<string, unknown>).error
        : "provider_error";
    throw new Error(`token_exchange_failed_${response.status}_${code}`);
  }
  const tokens = payload as Record<string, unknown>;
  if (
    typeof tokens.refresh_token !== "string" ||
    !tokens.refresh_token ||
    typeof tokens.access_token !== "string" ||
    !tokens.access_token ||
    typeof tokens.expires_in !== "number" ||
    !Number.isFinite(tokens.expires_in) ||
    typeof tokens.scope !== "string" ||
    !tokens.scope.split(" ").includes("media:read")
  )
    throw new Error("token_response_missing_required_fields_or_scope");

  console.log("\nStore this as the Cloudflare secret SIMKL_REFRESH_TOKEN:");
  console.log(tokens.refresh_token);
  console.log(
    "\nKeep the refresh token private; it remains valid for 180 days.",
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  run().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Simkl authorization failed",
    );
    process.exitCode = 1;
  });
}
