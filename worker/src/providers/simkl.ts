import type { LiveActivityResponse } from "../../../lib/live-activity.ts";
import {
  fetchProviderJson,
  record,
  safeText,
  timestamp,
} from "../provider-http.ts";
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
  if (!env.SIMKL_CLIENT_ID || !env.SIMKL_ACCESS_TOKEN)
    return { state: "unconfigured" };
  try {
    const identity = JSON.stringify([
      env.SIMKL_CLIENT_ID,
      env.SIMKL_ACCESS_TOKEN,
    ]);
    const headers = {
      Authorization: `Bearer ${env.SIMKL_ACCESS_TOKEN}`,
      "simkl-api-key": env.SIMKL_CLIENT_ID,
    };
    const activity = record(
      await fetchProviderJson(
        new URL("https://api.simkl.com/sync/activities"),
        { headers },
        deps,
      ),
    );
    const marker = JSON.stringify(activity);
    const cached = snapshots.get(deps.fetch);
    if (
      cached?.identity === identity &&
      cached.marker === marker &&
      deps.now() - cached.checkedAt < 3600000
    ) {
      const observedAt = cached.result.data?.observedAt;
      if (!observedAt || Date.parse(observedAt) >= deps.now() - 30 * 86400000)
        return cached.result;
      return { state: "empty" };
    }
    const url = new URL("https://api.simkl.com/sync/all-items/");
    url.searchParams.set(
      "date_from",
      new Date(deps.now() - 30 * 86400000).toISOString(),
    );
    const raw = await fetchProviderJson(url, { headers }, deps);
    const data = raw === null ? {} : record(raw);
    const candidates: NonNullable<LiveActivityResponse["simkl"]>[] = [];
    for (const [key, mediaType, contentKey] of [
      ["anime", "anime", "show"],
      ["shows", "tv", "show"],
      ["movies", "movie", "movie"],
    ] as const) {
      if (data[key] !== undefined && !Array.isArray(data[key]))
        throw Error("Invalid Simkl history");
      for (const rawItem of (data[key] ?? []) as unknown[]) {
        const item = record(rawItem);
        const content = record(item[contentKey]);
        const title = safeText(content.title);
        const observedAt = timestamp(item.last_watched_at ?? item.watched_at);
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
        const episodeMatch =
          typeof item.last_watched === "string"
            ? /E(\d+)$/.exec(item.last_watched)
            : null;
        candidates.push({
          mediaType,
          title,
          observedAt,
          episode: episodeMatch ? Number(episodeMatch[1]) : undefined,
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
  } catch {
    return { state: "unavailable" };
  }
}
