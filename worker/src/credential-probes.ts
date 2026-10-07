import { simklApiRequest } from "./simkl-http.ts";
import { getSimklAccessToken, SimklTokenError } from "./simkl-oauth.ts";
import { refreshSpotifyToken, SpotifyTokenError } from "./spotify-token.ts";
import type {
  CredentialProbeResult,
  Env,
  ProviderDependencies,
} from "./types.ts";

async function probeJson(
  url: URL,
  init: RequestInit,
  deps: ProviderDependencies,
  validate: (payload: unknown) => boolean,
): Promise<CredentialProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await deps.fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: "manual",
    });
    if (response.status === 401 || response.status === 403)
      return { state: "invalid", reason: "unauthorized" };
    if (!response.ok) return { state: "transient", reason: "provider_error" };
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { state: "transient", reason: "provider_error" };
    }
    return validate(payload)
      ? { state: "valid" }
      : { state: "transient", reason: "provider_error" };
  } catch {
    return { state: "transient", reason: "provider_error" };
  } finally {
    clearTimeout(timeout);
  }
}

async function probeWakaTime(
  apiKey: string | undefined,
  deps: ProviderDependencies,
): Promise<CredentialProbeResult> {
  if (!apiKey) return { state: "unconfigured" };
  return probeJson(
    new URL("https://api.wakatime.com/api/v1/users/current"),
    { headers: { Authorization: `Basic ${btoa(apiKey)}` } },
    deps,
    (payload) => {
      if (!payload || typeof payload !== "object" || Array.isArray(payload))
        return false;
      const data = (payload as Record<string, unknown>).data;
      return Boolean(data && typeof data === "object" && !Array.isArray(data));
    },
  );
}

async function probeSpotify(
  env: Env,
  deps: ProviderDependencies,
): Promise<CredentialProbeResult> {
  if (
    !env.SPOTIFY_CLIENT_ID ||
    !env.SPOTIFY_CLIENT_SECRET ||
    !env.SPOTIFY_REFRESH_TOKEN
  )
    return { state: "unconfigured" };
  try {
    await refreshSpotifyToken(env, deps, { force: true });
    return { state: "valid" };
  } catch (error) {
    if (!(error instanceof SpotifyTokenError))
      return { state: "transient", reason: "provider_error" };
    if (error.code === "invalid_grant")
      return { state: "invalid", reason: "invalid_token" };
    if (error.code === "invalid_client" || error.status === 401)
      return { state: "invalid", reason: "invalid_client" };
    return { state: "transient", reason: "provider_error" };
  }
}

async function probeSimkl(
  env: Env,
  deps: ProviderDependencies,
): Promise<CredentialProbeResult> {
  if (
    !env.SIMKL_CLIENT_ID ||
    (!env.SIMKL_ACCESS_TOKEN &&
      !(env.SIMKL_REFRESH_TOKEN && env.SIMKL_TOKEN_STORE))
  )
    return { state: "unconfigured" };
  const url = new URL("https://api.simkl.com/sync/activities");
  const validate = (payload: unknown) =>
    Boolean(payload && typeof payload === "object" && !Array.isArray(payload));
  const run = async (force = false) => {
    const accessToken = await getSimklAccessToken(env, { force });
    const request = simklApiRequest(
      url,
      env.SIMKL_CLIENT_ID as string,
      accessToken,
    );
    return probeJson(request.url, { headers: request.headers }, deps, validate);
  };

  try {
    const result = await run();
    if (
      result.state === "invalid" &&
      env.SIMKL_REFRESH_TOKEN &&
      env.SIMKL_TOKEN_STORE
    )
      return await run(true);
    return result;
  } catch (error) {
    if (error instanceof SimklTokenError) {
      if (error.code === "invalid_grant")
        return { state: "invalid", reason: "invalid_token" };
      if (error.code === "invalid_client")
        return { state: "invalid", reason: "invalid_client" };
    }
    return { state: "transient", reason: "provider_error" };
  }
}

async function probeSteam(
  env: Env,
  deps: ProviderDependencies,
): Promise<CredentialProbeResult> {
  if (!env.STEAM_API_KEY || !env.STEAM_ID || !/^\d{17}$/.test(env.STEAM_ID))
    return { state: "unconfigured" };
  const url = new URL(
    "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/",
  );
  url.searchParams.set("key", env.STEAM_API_KEY);
  url.searchParams.set("steamids", env.STEAM_ID);
  return probeJson(url, {}, deps, (payload) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      return false;
    const response = (payload as Record<string, unknown>).response;
    if (!response || typeof response !== "object" || Array.isArray(response))
      return false;
    return Array.isArray((response as Record<string, unknown>).players);
  });
}

export async function probeActivityCredentials(
  env: Env,
  deps: ProviderDependencies,
): Promise<
  Record<"coding" | "spotify" | "simkl" | "steam", CredentialProbeResult>
> {
  const [coding, spotify, simkl, steam] = await Promise.all([
    probeWakaTime(env.WAKATIME_API_KEY, deps),
    probeSpotify(env, deps),
    probeSimkl(env, deps),
    probeSteam(env, deps),
  ]);
  return { coding, spotify, simkl, steam };
}
