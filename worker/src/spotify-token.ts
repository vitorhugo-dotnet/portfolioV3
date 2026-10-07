import type { Env, ProviderDependencies } from "./types.ts";

type CachedToken = {
  identity: string;
  token: string;
  expiresAt: number;
};

const tokenCaches = new WeakMap<typeof fetch, Map<string, CachedToken>>();

export class SpotifyTokenError extends Error {
  readonly code?: string;
  readonly status?: number;

  constructor(options: { code?: string; status?: number } = {}) {
    super("Spotify token refresh failed");
    this.name = "SpotifyTokenError";
    this.code = options.code;
    this.status = options.status;
  }
}

function spotifyErrorCode(value: unknown): string | undefined {
  if (
    value === "invalid_grant" ||
    value === "invalid_client" ||
    value === "unauthorized" ||
    value === "slow_down" ||
    value === "invalid_request" ||
    value === "unsupported_grant_type"
  )
    return value;
  return undefined;
}

export async function refreshSpotifyToken(
  env: Env,
  deps: ProviderDependencies,
  options: { force?: boolean } = {},
): Promise<string> {
  const {
    SPOTIFY_CLIENT_ID: client,
    SPOTIFY_CLIENT_SECRET: secret,
    SPOTIFY_REFRESH_TOKEN: refresh,
  } = env;
  if (!client || !secret || !refresh) throw new SpotifyTokenError();

  const identity = JSON.stringify([client, secret, refresh]);
  const cache = tokenCaches.get(deps.fetch);
  const cached = cache?.get(identity);
  if (!options.force && cached && cached.expiresAt > deps.now())
    return cached.token;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  let response: Response;
  try {
    response = await deps.fetch(
      new URL("https://accounts.spotify.com/api/token"),
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${client}:${secret}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refresh,
        }).toString(),
        signal: controller.signal,
        redirect: "manual",
      },
    );
  } catch {
    throw new SpotifyTokenError();
  } finally {
    clearTimeout(timer);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new SpotifyTokenError({ status: response.status });
  }
  const body =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  if (!response.ok) {
    const code = spotifyErrorCode(body.error);
    throw new SpotifyTokenError({
      code: code ?? (response.status === 401 ? "unauthorized" : undefined),
      status: response.status,
    });
  }
  if (
    typeof body.access_token !== "string" ||
    !body.access_token ||
    typeof body.expires_in !== "number" ||
    !Number.isFinite(body.expires_in) ||
    body.expires_in <= 0
  )
    throw new SpotifyTokenError({ status: response.status });

  const token = body.access_token;
  const refreshedCache = cache ?? new Map<string, CachedToken>();
  if (!cache) tokenCaches.set(deps.fetch, refreshedCache);
  refreshedCache.set(identity, {
    identity,
    token,
    expiresAt: deps.now() + body.expires_in * 1000 - 30000,
  });
  return token;
}

export function spotifyAgeStage(
  authorizedAt: string | undefined,
  now: number,
): "warning" | "expired" | undefined {
  if (!authorizedAt) return undefined;
  const authorizedAtMs = Date.parse(authorizedAt);
  if (!Number.isFinite(authorizedAtMs) || authorizedAtMs > now)
    return undefined;
  const age = now - authorizedAtMs;
  if (age >= 180 * 86400000) return "expired";
  if (age >= 173 * 86400000) return "warning";
  return undefined;
}
