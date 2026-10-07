import type { Env, ProviderDependencies } from "./types.ts";

const TOKEN_ENDPOINT = "https://api.simkl.com/oauth2/token";
const TOKEN_STATE_KEY = "simkl-oauth";
const TOKEN_EXPIRY_SKEW_MS = 60_000;

export interface SimklStoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface SimklTokenStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
}

export interface SimklTokenStateLike {
  storage: SimklTokenStorage;
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
}

export class SimklTokenError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number) {
    super(code);
    this.name = "SimklTokenError";
    this.code = code;
    this.status = status;
  }
}

function oauthErrorCode(value: unknown): string {
  return typeof value === "string" && /^[a-z][a-z0-9_]{0,47}$/.test(value)
    ? value
    : "provider_error";
}

function storedTokens(value: unknown): SimklStoredTokens | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const candidate = value as Partial<SimklStoredTokens>;
  return typeof candidate.accessToken === "string" &&
    candidate.accessToken.length > 0 &&
    typeof candidate.refreshToken === "string" &&
    candidate.refreshToken.length > 0 &&
    typeof candidate.expiresAt === "number" &&
    Number.isFinite(candidate.expiresAt)
    ? (candidate as SimklStoredTokens)
    : undefined;
}

export async function refreshSimklAccessToken(
  env: Env,
  storage: SimklTokenStorage,
  deps: ProviderDependencies,
  options: { force?: boolean } = {},
): Promise<string> {
  const current = storedTokens(await storage.get<unknown>(TOKEN_STATE_KEY));
  if (
    !options.force &&
    current &&
    current.expiresAt > deps.now() + TOKEN_EXPIRY_SKEW_MS
  )
    return current.accessToken;

  const clientId = env.SIMKL_CLIENT_ID;
  const refreshToken = current?.refreshToken ?? env.SIMKL_REFRESH_TOKEN;
  if (!clientId || !refreshToken)
    throw new SimklTokenError("unconfigured", 503);

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  if (env.SIMKL_CLIENT_SECRET)
    body.set("client_secret", env.SIMKL_CLIENT_SECRET);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await deps.fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "portfolio-v3/3.0.0",
      },
      body: body.toString(),
      signal: controller.signal,
      redirect: "manual",
    });
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new SimklTokenError("provider_error", response.status || 502);
    }
    if (!response.ok) {
      const code =
        payload && typeof payload === "object" && !Array.isArray(payload)
          ? oauthErrorCode((payload as Record<string, unknown>).error)
          : "provider_error";
      throw new SimklTokenError(code, response.status);
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      throw new SimklTokenError("provider_error", 502);
    const result = payload as Record<string, unknown>;
    if (
      typeof result.access_token !== "string" ||
      !result.access_token ||
      typeof result.refresh_token !== "string" ||
      !result.refresh_token ||
      typeof result.expires_in !== "number" ||
      !Number.isFinite(result.expires_in) ||
      result.expires_in <= 0
    )
      throw new SimklTokenError("provider_error", 502);

    const next: SimklStoredTokens = {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      expiresAt: deps.now() + result.expires_in * 1000,
    };
    await storage.put(TOKEN_STATE_KEY, next);
    return next.accessToken;
  } catch (error) {
    if (error instanceof SimklTokenError) throw error;
    throw new SimklTokenError("provider_error", 503);
  } finally {
    clearTimeout(timer);
  }
}

export async function getSimklAccessToken(
  env: Env,
  options: { force?: boolean } = {},
): Promise<string> {
  if (env.SIMKL_REFRESH_TOKEN && env.SIMKL_TOKEN_STORE) {
    const id = env.SIMKL_TOKEN_STORE.idFromName("simkl-token-store");
    const stub = env.SIMKL_TOKEN_STORE.get(id);
    const response = await stub.fetch(
      new Request("https://simkl-token-store/access-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: options.force === true }),
      }),
    );
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new SimklTokenError("provider_error", response.status || 502);
    }
    if (!response.ok) {
      const code =
        payload && typeof payload === "object" && !Array.isArray(payload)
          ? oauthErrorCode((payload as Record<string, unknown>).error)
          : "provider_error";
      throw new SimklTokenError(code, response.status);
    }
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      typeof (payload as Record<string, unknown>).access_token !== "string"
    )
      throw new SimklTokenError("provider_error", 502);
    return (payload as { access_token: string }).access_token;
  }
  if (env.SIMKL_ACCESS_TOKEN) return env.SIMKL_ACCESS_TOKEN;
  if (env.SIMKL_REFRESH_TOKEN)
    throw new SimklTokenError("token_store_required", 503);
  throw new SimklTokenError("unconfigured", 503);
}

export class SimklTokenStore {
  private state: SimklTokenStateLike;
  private env: Env;

  constructor(state: SimklTokenStateLike, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    return this.state.blockConcurrencyWhile(() => this.handle(request));
  }

  private async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/access-token")
      return Response.json({ error: "not_found" }, { status: 404 });
    if (request.method !== "POST")
      return Response.json({ error: "method_not_allowed" }, { status: 405 });

    let force = false;
    try {
      const body: unknown = await request.json();
      force = Boolean(
        body &&
          typeof body === "object" &&
          !Array.isArray(body) &&
          (body as Record<string, unknown>).force === true,
      );
    } catch {
      return Response.json({ error: "invalid_request" }, { status: 400 });
    }

    try {
      const accessToken = await refreshSimklAccessToken(
        this.env,
        this.state.storage,
        {
          fetch: (input, init) => globalThis.fetch(input, init),
          now: Date.now,
        },
        { force },
      );
      return Response.json(
        { access_token: accessToken },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      const tokenError =
        error instanceof SimklTokenError
          ? error
          : new SimklTokenError("provider_error", 503);
      return Response.json(
        { error: tokenError.code },
        {
          status: tokenError.status,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
  }
}
