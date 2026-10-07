import {
  fetchProviderJson,
  ProviderHttpError,
  record,
  safeHttpsUrl,
  safeText,
  timestamp,
} from "../provider-http.ts";
import { refreshSpotifyToken } from "../spotify-token.ts";
import type { Env, ProviderDependencies, ProviderResult } from "../types.ts";
export async function getSpotify(
  env: Env,
  deps: ProviderDependencies,
): Promise<ProviderResult<"spotify">> {
  const {
    SPOTIFY_CLIENT_ID: client,
    SPOTIFY_CLIENT_SECRET: secret,
    SPOTIFY_REFRESH_TOKEN: refresh,
  } = env;
  if (!client || !secret || !refresh) return { state: "unconfigured" };
  try {
    async function request(path: string): Promise<unknown> {
      try {
        return await fetchProviderJson(
          new URL(`https://api.spotify.com/v1/${path}`),
          {
            headers: {
              Authorization: `Bearer ${await refreshSpotifyToken(env, deps)}`,
            },
          },
          deps,
        );
      } catch (error) {
        if (!(error instanceof ProviderHttpError) || error.status !== 401)
          throw error;
        return fetchProviderJson(
          new URL(`https://api.spotify.com/v1/${path}`),
          {
            headers: {
              Authorization: `Bearer ${await refreshSpotifyToken(env, deps, { force: true })}`,
            },
          },
          deps,
        );
      }
    }
    const current = await request("me/player/currently-playing");
    let item: unknown;
    let observedAt: string | undefined;
    let isPlaying = false;
    if (
      current &&
      record(current).is_playing === true &&
      record(current).item
    ) {
      item = record(current).item;
      isPlaying = true;
    } else {
      const recent = record(await request("me/player/recently-played?limit=1"));
      if (!Array.isArray(recent.items)) throw Error("Invalid Spotify history");
      if (!recent.items.length) return { state: "empty" };
      const entry = record(recent.items[0]);
      item = entry.track;
      observedAt = timestamp(entry.played_at);
    }
    const track = record(item);
    const name = safeText(track.name);
    if (!name) throw Error("Missing track title");
    const album = track.album ? record(track.album) : {};
    const images = Array.isArray(album.images) ? album.images : [];
    return {
      state: "available",
      data: {
        isPlaying,
        track: name,
        observedAt,
        artist: Array.isArray(track.artists)
          ? safeText(
              track.artists
                .map((a) => safeText(record(a).name))
                .filter(Boolean)
                .join(", "),
            )
          : undefined,
        album: safeText(album.name),
        artworkUrl: images[0]
          ? safeHttpsUrl(record(images[0]).url, ["i.scdn.co"])
          : undefined,
        externalUrl: track.external_urls
          ? safeHttpsUrl(record(track.external_urls).spotify, [
              "open.spotify.com",
            ])
          : undefined,
      },
    };
  } catch {
    return { state: "unavailable" };
  }
}
