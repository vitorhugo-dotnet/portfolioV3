import type { LiveActivityResponse } from "../../../lib/live-activity.ts";
import {
  fetchProviderJson,
  ProviderHttpError,
  record,
  safeText,
  timestamp,
} from "../provider-http.ts";
import { simklApiRequest } from "../simkl-http.ts";
import { getSimklAccessToken } from "../simkl-oauth.ts";
import type { Env, ProviderDependencies, ProviderResult } from "../types.ts";

const snapshots = new WeakMap<
  typeof fetch,
  {
    identity: string;
    marker: string;
    checkedAt: number;
    result: ProviderResult<"simkl">;
  }
>();
export async function getSimkl(
  env: Env,
  deps: ProviderDependencies,
): Promise<ProviderResult<"simkl">> {
  const clientId = env.SIMKL_CLIENT_ID;
  if (
    !clientId ||
    (!env.SIMKL_ACCESS_TOKEN &&
      !(env.SIMKL_REFRESH_TOKEN && env.SIMKL_TOKEN_STORE))
  )
    return { state: "unconfigured" };
  try {
    let accessToken = await getSimklAccessToken(env);
    const fetchSimklJson = async (url: URL): Promise<unknown> => {
      const request = () => simklApiRequest(url, clientId, accessToken);
      const currentRequest = request();
      try {
        return await fetchProviderJson(
          currentRequest.url,
          { headers: currentRequest.headers },
          deps,
        );
      } catch (error) {
        if (
          !(error instanceof ProviderHttpError) ||
          error.status !== 401 ||
          !env.SIMKL_REFRESH_TOKEN ||
          !env.SIMKL_TOKEN_STORE
        )
          throw error;
        accessToken = await getSimklAccessToken(env, { force: true });
        const retryRequest = request();
        return fetchProviderJson(
          retryRequest.url,
          { headers: retryRequest.headers },
          deps,
        );
      }
    };
    const identity = JSON.stringify([clientId, accessToken]);
    const activity = record(
      await fetchSimklJson(new URL("https://api.simkl.com/sync/activities")),
    );
    const marker = JSON.stringify(activity);
    const cached = snapshots.get(deps.fetch);
    if (
      cached?.identity === identity &&
      cached.marker === marker &&
      deps.now() - cached.checkedAt < 3600000
    ) {
      const observedAt = cached.result.data?.observedAt;
      if (!observedAt || Date.parse(observedAt) >= deps.now() - 30 * 86400000) {
        if (cached.result.data && observedAt) {
          return {
            ...cached.result,
            data: {
              ...cached.result.data,
              isActive:
                Date.parse(observedAt) <= deps.now() &&
                Date.parse(observedAt) > deps.now() - 40 * 60000,
            },
          };
        }
        return cached.result;
      }
      return { state: "empty" };
    }
    const history = await Promise.all(
      (
        [
          ["anime", "anime", "anime"],
          ["shows", "tv", "show"],
          ["movies", "movie", "movie"],
        ] as const
      ).map(async ([type, mediaType, contentKey]) => {
        const url = new URL("https://api.simkl.com/sync/history");
        url.searchParams.set("type", type);
        url.searchParams.set(
          "date_from",
          new Date(deps.now() - 30 * 86400000).toISOString(),
        );
        url.searchParams.set("limit", "100");
        const raw = await fetchSimklJson(url);
        if (raw === null) return { mediaType, contentKey, entries: [] };
        if (!Array.isArray(raw)) throw Error("Invalid Simkl history");
        return { mediaType, contentKey, entries: raw };
      }),
    );
    const candidates: NonNullable<LiveActivityResponse["simkl"]>[] = [];
    for (const { mediaType, contentKey, entries } of history) {
      for (const rawItem of entries) {
        const item = record(rawItem);
        const content = record(
          item[contentKey] ?? (mediaType === "anime" ? item.show : undefined),
        );
        const title = safeText(content.title);
        const observedAt = timestamp(item.watched_at);
        if (
          !title ||
          !observedAt ||
          Date.parse(observedAt) > deps.now() ||
          Date.parse(observedAt) < deps.now() - 30 * 86400000
        )
          continue;
        const ids = content.ids ? record(content.ids) : {};
        const id =
          typeof ids.simkl === "number" &&
          Number.isSafeInteger(ids.simkl) &&
          ids.simkl > 0
            ? String(ids.simkl)
            : undefined;
        const poster =
          typeof content.poster === "string" &&
          /^\d+\/[a-f\d]+$/.test(content.poster)
            ? content.poster
            : undefined;
        const episode = item.episode ? record(item.episode) : {};
        const episodeMatch =
          typeof item.last_watched === "string"
            ? /E(\d+)$/.exec(item.last_watched)
            : null;
        const episodeNumber =
          typeof episode.number === "number" &&
          Number.isSafeInteger(episode.number)
            ? episode.number
            : episodeMatch
              ? Number(episodeMatch[1])
              : undefined;
        candidates.push({
          mediaType,
          title,
          observedAt,
          episode: episodeNumber,
          isActive: Date.parse(observedAt) > deps.now() - 40 * 60000,
          posterUrl: poster
            ? `https://simkl.in/posters/${poster}_m.webp`
            : undefined,
          externalUrl: id
            ? `https://simkl.com/${mediaType === "tv" ? "tv" : mediaType === "movie" ? "movies" : "anime"}/${id}/`
            : "https://simkl.com/",
        });
      }
    }
    candidates.sort(
      (a, b) =>
        Date.parse(b.observedAt as string) - Date.parse(a.observedAt as string),
    );
    const result: ProviderResult<"simkl"> = candidates[0]
      ? { state: "available", data: candidates[0] }
      : { state: "empty" };
    snapshots.set(deps.fetch, {
      identity,
      marker,
      checkedAt: deps.now(),
      result,
    });
    return result;
  } catch (error) {
    console.error("provider_error", {
      provider: "simkl",
      status: error instanceof ProviderHttpError ? error.status : undefined,
      error:
        error instanceof ProviderHttpError
          ? "Provider request failed"
          : error instanceof Error
            ? error.message
            : "Unknown error",
    });
    return { state: "unavailable" };
  }
}
