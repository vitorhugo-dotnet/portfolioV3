import assert from "node:assert/strict";
import { test } from "node:test";
import { collectActivity } from "../worker/src/activity.ts";
import { getSimkl } from "../worker/src/providers/simkl.ts";
import { getSpotify } from "../worker/src/providers/spotify.ts";
import { getSteam } from "../worker/src/providers/steam.ts";
import { getCoding } from "../worker/src/providers/wakatime.ts";
import type { ProviderDependencies } from "../worker/src/types.ts";

const now = Date.parse("2026-10-07T12:00:00Z");
function deps(
  handler: (url: URL, init?: RequestInit) => unknown,
): ProviderDependencies {
  return {
    now: () => now,
    fetch: async (url, init) => {
      const result = handler(new URL(String(url)), init);
      return result instanceof Response ? result : Response.json(result);
    },
  };
}
test("coding is active only for a recent nonfuture heartbeat and hides project paths", async () => {
  for (const [age, status] of [
    [299, "active"],
    [301, "idle"],
    [-10, "idle"],
  ] as const) {
    const d = deps((url) =>
      url.pathname.endsWith("heartbeats")
        ? {
            data: [
              {
                time: now / 1000 - age,
                language: "TypeScript",
                editor: "VS Code",
                project: "private",
                entity: "/secret/file",
              },
            ],
          }
        : {
            data: [
              {
                grand_total: { total_seconds: 1800 },
                languages: [{ name: "TypeScript" }],
                editors: [{ name: "VS Code" }],
              },
            ],
          },
    );
    const result = await getCoding({ WAKATIME_API_KEY: "sentinel" }, d);
    assert.equal(result.data?.status, status);
    assert.equal(result.data?.durationMinutes, 30);
    assert.equal(result.data?.project, undefined);
    assert.ok(!JSON.stringify(result).includes("/secret"));
  }
});
test("coding without a heartbeat does not invent current activity", async () => {
  const result = await getCoding(
    { WAKATIME_API_KEY: "key" },
    deps((url) =>
      url.pathname.endsWith("heartbeats")
        ? { data: [] }
        : { data: [{ grand_total: { total_seconds: 60 } }] },
    ),
  );
  assert.equal(result.data?.status, "idle");
  assert.equal(result.data?.observedAt, undefined);
});
test("WakaTime uses the API key directly and explicit summary dates", async () => {
  let authorization: string | null = null;
  let summaryUrl: URL | undefined;
  await getCoding(
    { WAKATIME_API_KEY: "12345" },
    deps((url, init) => {
      authorization = new Headers(init?.headers).get("Authorization");
      if (url.pathname.endsWith("summaries")) summaryUrl = url;
      return { data: [] };
    }),
  );
  assert.equal(authorization, "Basic MTIzNDU=");
  assert.equal(summaryUrl?.searchParams.get("start"), "2026-10-07");
  assert.equal(summaryUrl?.searchParams.get("end"), "2026-10-07");
  assert.equal(summaryUrl?.searchParams.has("range"), false);
});
const track = {
  name: "Track",
  artists: [{ name: "Artist" }],
  album: { name: "Album", images: [{ url: "https://i.scdn.co/image/abc" }] },
  external_urls: { spotify: "https://open.spotify.com/track/abc" },
};
test("Spotify refresh stays server-side and the token is reused", async () => {
  let refreshes = 0;
  const env = {
    SPOTIFY_CLIENT_ID: "reuse",
    SPOTIFY_CLIENT_SECRET: "secret",
    SPOTIFY_REFRESH_TOKEN: "refresh",
  };
  const d = deps((url) => {
    if (url.hostname === "accounts.spotify.com") {
      refreshes++;
      return { access_token: "private-token", expires_in: 3600 };
    }
    return { is_playing: true, item: track };
  });
  const result = await getSpotify(env, d);
  await getSpotify(env, d);
  assert.equal(refreshes, 1);
  assert.equal(result.data?.isPlaying, true);
  assert.equal(result.data?.track, "Track");
  assert.ok(!JSON.stringify(result).includes("private-token"));
});
test("Spotify renews expired tokens and uses recently played after 204", async () => {
  let refreshes = 0;
  const env = {
    SPOTIFY_CLIENT_ID: "expiration",
    SPOTIFY_CLIENT_SECRET: "secret",
    SPOTIFY_REFRESH_TOKEN: "refresh",
  };
  const d = deps((url) => {
    if (url.hostname === "accounts.spotify.com") {
      refreshes++;
      return { access_token: "token", expires_in: 60 };
    }
    if (url.pathname.endsWith("currently-playing"))
      return new Response(null, { status: 204 });
    return { items: [{ track, played_at: "2026-10-07T11:00:00Z" }] };
  });
  assert.equal((await getSpotify(env, d)).data?.isPlaying, false);
  await getSpotify(env, { ...d, now: () => now + 61000 });
  assert.equal(refreshes, 2);
});
test("Spotify retries 401 only once and degrades on the second failure", async () => {
  let refreshes = 0;
  const result = await getSpotify(
    {
      SPOTIFY_CLIENT_ID: "unauthorized",
      SPOTIFY_CLIENT_SECRET: "s",
      SPOTIFY_REFRESH_TOKEN: "r",
    },
    deps((url) => {
      if (url.hostname === "accounts.spotify.com") {
        refreshes++;
        return { access_token: "token", expires_in: 3600 };
      }
      return new Response(null, { status: 401 });
    }),
  );
  assert.equal(refreshes, 2);
  assert.equal(result.state, "unavailable");
});
test("Simkl checks last activity and returns only sanitized recent history", async () => {
  const result = await getSimkl(
    { SIMKL_CLIENT_ID: "client", SIMKL_ACCESS_TOKEN: "simkl-secret" },
    deps((url, init) => {
      if (url.pathname.endsWith("activities")) {
        assert.equal(init?.method, "POST");
        return { all: "2026-10-07T10:00:00Z" };
      }
      assert.ok(url.searchParams.has("date_from"));
      return {
        anime: [
          {
            last_watched_at: "2026-10-07T10:00:00Z",
            last_watched: "E12",
            show: {
              title: "Anime",
              poster: "83/83975f751784587",
              ids: { simkl: 40398 },
            },
          },
        ],
      };
    }),
  );
  assert.equal(result.data?.title, "Anime");
  assert.equal(result.data?.episode, 12);
  assert.equal(result.data?.mediaType, "anime");
  assert.ok(!JSON.stringify(result).includes("simkl-secret"));
});
test("Simkl handles null history and malformed payload independently", async () => {
  assert.equal(
    (
      await getSimkl(
        { SIMKL_CLIENT_ID: "empty", SIMKL_ACCESS_TOKEN: "token" },
        deps((url) => (url.pathname.endsWith("activities") ? {} : null)),
      )
    ).state,
    "empty",
  );
  assert.equal(
    (
      await getSimkl(
        { SIMKL_CLIENT_ID: "invalid", SIMKL_ACCESS_TOKEN: "token" },
        deps(() => "wrong"),
      )
    ).state,
    "unavailable",
  );
});
test("Steam detects current game and recent fallback without exposing Steam ID", async () => {
  for (const current of [true, false]) {
    const result = await getSteam(
      { STEAM_API_KEY: "steam-secret", STEAM_ID: "76561198000000000" },
      deps((url) =>
        url.pathname.includes("GetPlayerSummaries")
          ? {
              response: {
                players: [
                  {
                    ...(current
                      ? { gameid: "570", gameextrainfo: "Dota 2" }
                      : {}),
                  },
                ],
              },
            }
          : {
              response: {
                games: [
                  {
                    appid: 730,
                    name: "Counter-Strike",
                    playtime_2weeks: 20,
                    img_icon_url: "abc",
                  },
                ],
              },
            },
      ),
    );
    assert.equal(result.data?.isPlaying, current);
    assert.equal(result.data?.appId, current ? "570" : "730");
    assert.ok(!JSON.stringify(result).includes("76561198000000000"));
    assert.ok(!JSON.stringify(result).includes("steam-secret"));
  }
});
test("Steam private and empty profiles do not break the section", async () => {
  assert.equal(
    (
      await getSteam(
        { STEAM_API_KEY: "k", STEAM_ID: "76561198000000000" },
        deps((url) =>
          url.pathname.includes("GetPlayerSummaries")
            ? { response: { players: [] } }
            : { response: {} },
        ),
      )
    ).state,
    "empty",
  );
  assert.equal(
    (
      await getSteam(
        { STEAM_API_KEY: "k", STEAM_ID: "76561198000000000" },
        deps(() => new Response(null, { status: 429 })),
      )
    ).state,
    "unavailable",
  );
});
test("missing credentials skip calls and provider failures remain isolated", async () => {
  const result = await collectActivity(
    { STEAM_API_KEY: "steam-secret", STEAM_ID: "76561198000000000" },
    deps(() => {
      throw Error("private response");
    }),
  );
  assert.deepEqual(result.providerStates, {
    coding: "unconfigured",
    spotify: "unconfigured",
    simkl: "unconfigured",
    steam: "unavailable",
  });
  assert.ok(!JSON.stringify(result).includes("private response"));
  assert.equal(
    (
      await getSpotify(
        {},
        deps(() => {
          throw Error("must not call");
        }),
      )
    ).state,
    "unconfigured",
  );
});

test("coding remains active across UTC and account-local midnight", async () => {
  for (const [time, timezone, heartbeatDay] of [
    ["2026-10-07T00:01:00Z", "UTC", "2026-10-06"],
    ["2026-10-07T03:01:00Z", "America/Fortaleza", "2026-10-06"],
    ["2026-10-07T00:01:00Z", "America/Fortaleza", "2026-10-06"],
  ]) {
    const clock = Date.parse(time);
    const d = deps((url) =>
      url.pathname.endsWith("heartbeats")
        ? {
            timezone,
            data:
              url.searchParams.get("date") === heartbeatDay
                ? [{ time: clock / 1000 - 120, language: "TypeScript" }]
                : [],
          }
        : { data: [{ grand_total: { total_seconds: 60 } }] },
    );
    const result = await getCoding(
      { WAKATIME_API_KEY: "key" },
      { ...d, now: () => clock },
    );
    assert.equal(result.data?.status, "active", `${timezone} at ${time}`);
    assert.equal(
      result.data?.observedAt,
      new Date(clock - 120000).toISOString(),
    );
  }
});
test("Simkl excludes old watch dates even when recently rated", async () => {
  const result = await getSimkl(
    { SIMKL_CLIENT_ID: "old-rating", SIMKL_ACCESS_TOKEN: "token" },
    deps((url) =>
      url.pathname.endsWith("activities")
        ? { all: "2026-10-07T11:00:00Z" }
        : {
            movies: [
              {
                watched_at: "2020-01-01T00:00:00Z",
                user_rated_at: "2026-10-07T11:00:00Z",
                movie: { title: "Old movie", ids: { simkl: 123 } },
              },
            ],
          },
    ),
  );
  assert.equal(result.state, "empty");
  assert.equal(result.data, undefined);
});
test("Simkl cached observations expire when leaving the recent window", async () => {
  const watchedAt = new Date(now - 30 * 86400000 + 1000).toISOString();
  const d = deps((url) =>
    url.pathname.endsWith("activities")
      ? { all: "2026-10-07T11:00:00Z" }
      : {
          movies: [
            {
              watched_at: watchedAt,
              movie: { title: "Recent until now", ids: { simkl: 123 } },
            },
          ],
        },
  );
  const env = { SIMKL_CLIENT_ID: "boundary", SIMKL_ACCESS_TOKEN: "token" };
  assert.equal((await getSimkl(env, d)).state, "available");
  assert.equal(
    (await getSimkl(env, { ...d, now: () => now + 2000 })).state,
    "empty",
  );
});
