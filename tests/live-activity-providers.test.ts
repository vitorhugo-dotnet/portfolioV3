import assert from "node:assert/strict";
import { test } from "node:test";
import { collectActivity } from "../worker/src/activity.ts";
import { getSimkl } from "../worker/src/providers/simkl.ts";
import { getSpotify } from "../worker/src/providers/spotify.ts";
import { getSteam } from "../worker/src/providers/steam.ts";
import { getCoding } from "../worker/src/providers/wakatime.ts";
import {
  refreshSpotifyToken,
  SpotifyTokenError,
  spotifyAgeStage,
} from "../worker/src/spotify-token.ts";
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
    [899, "active"],
    [900, "idle"],
    [901, "idle"],
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
test("coding uses a 15-minute window, prioritizes useful languages, and masks filenames", async () => {
  const result = await getCoding(
    { WAKATIME_API_KEY: "sentinel" },
    deps((url) =>
      url.pathname.endsWith("heartbeats")
        ? {
            data: [
              {
                time: now / 1000 - 60,
                language: "Text",
                entity: "/home/private/notes.txt",
              },
              {
                time: now / 1000 - 120,
                language: "Java",
                entity: "/home/private/portfolio/src/PortfolioEditor.java",
              },
            ],
          }
        : { data: [] },
    ),
  );
  assert.equal(result.data?.status, "active");
  assert.equal(result.data?.language, "Java");
  assert.equal(result.data?.file, "***folioEditor.java");
  assert.ok(!JSON.stringify(result).includes("/home/private"));
  assert.ok(!JSON.stringify(result).includes("notes.txt"));
});
test("coding is idle after 15 minutes and does not expose a full filename", async () => {
  const result = await getCoding(
    { WAKATIME_API_KEY: "sentinel" },
    deps((url) =>
      url.pathname.endsWith("heartbeats")
        ? {
            data: [
              {
                time: now / 1000 - 901,
                language: "C#",
                entity: "/home/private/PortfolioEditor.cs",
              },
            ],
          }
        : { data: [] },
    ),
  );
  assert.equal(result.data?.status, "idle");
  assert.equal(result.data?.file, "***rtfolioEditor.cs");
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
test("Spotify refresh classifies invalid credentials without exposing provider bodies", async () => {
  const env = {
    SPOTIFY_CLIENT_ID: "client-sentinel",
    SPOTIFY_CLIENT_SECRET: "secret-sentinel",
    SPOTIFY_REFRESH_TOKEN: "refresh-sentinel",
  };
  for (const [response, code, status] of [
    [
      Response.json({ error: "invalid_grant" }, { status: 400 }),
      "invalid_grant",
      400,
    ],
    [
      Response.json({ error: "invalid_client" }, { status: 401 }),
      "invalid_client",
      401,
    ],
    [
      Response.json({ error: "unauthorized" }, { status: 401 }),
      "unauthorized",
      401,
    ],
    [Response.json({ error: "slow_down" }, { status: 429 }), "slow_down", 429],
  ] as const) {
    await assert.rejects(
      refreshSpotifyToken(
        env,
        deps(() => response),
      ),
      (error: unknown) => {
        assert.ok(error instanceof SpotifyTokenError);
        assert.equal(error.code, code);
        assert.equal(error.status, status);
        assert.ok(!error.message.includes("sentinel"));
        return true;
      },
    );
  }
});
test("Spotify refresh treats server, timeout and malformed success as non-auth errors", async () => {
  const env = {
    SPOTIFY_CLIENT_ID: "server-error",
    SPOTIFY_CLIENT_SECRET: "secret",
    SPOTIFY_REFRESH_TOKEN: "refresh",
  };
  for (const response of [
    new Response("unavailable", { status: 503 }),
    Response.json({ expires_in: 3600 }),
  ]) {
    await assert.rejects(
      refreshSpotifyToken(
        env,
        deps(() => response),
      ),
      (error: unknown) => {
        assert.ok(error instanceof SpotifyTokenError);
        assert.notEqual(error.code, "invalid_grant");
        assert.notEqual(error.code, "invalid_client");
        return true;
      },
    );
  }
  const timeoutDeps: ProviderDependencies = {
    now: () => now,
    fetch: async (_input, init) => {
      assert.ok(init?.signal);
      throw new DOMException("Aborted", "AbortError");
    },
  };
  await assert.rejects(
    refreshSpotifyToken(env, timeoutDeps),
    (error: unknown) => {
      assert.ok(error instanceof SpotifyTokenError);
      assert.equal(error.code, undefined);
      return true;
    },
  );
});
test("Spotify authorization age uses inclusive 173 and 180 day boundaries", () => {
  const day = 86400000;
  const hour = 3600000;
  for (const [age, expected] of [
    [172 * day + 23 * hour, undefined],
    [173 * day, "warning"],
    [179 * day + 23 * hour, "warning"],
    [180 * day, "expired"],
  ] as const) {
    assert.equal(
      spotifyAgeStage(new Date(now - age).toISOString(), now),
      expected,
    );
  }
  assert.equal(spotifyAgeStage(undefined, now), undefined);
  assert.equal(spotifyAgeStage("not-a-date", now), undefined);
  assert.equal(
    spotifyAgeStage(new Date(now + day).toISOString(), now),
    undefined,
  );
});
test("Simkl checks last activity and returns only sanitized recent history", async () => {
  const result = await getSimkl(
    { SIMKL_CLIENT_ID: "client", SIMKL_ACCESS_TOKEN: "simkl-secret" },
    deps((url, init) => {
      if (url.pathname.endsWith("activities")) {
        assert.equal(init?.method, "POST");
        return { all: "2026-10-07T11:30:00Z" };
      }
      assert.equal(url.pathname, "/sync/history");
      assert.equal(init?.method, undefined);
      assert.ok(url.searchParams.has("date_from"));
      return url.searchParams.get("type") === "anime"
        ? [
            {
              watched_at: "2026-10-07T11:30:00Z",
              last_watched: "E12",
              show: {
                title: "Anime",
                poster: "83/83975f751784587",
                ids: { simkl: 40398 },
              },
            },
          ]
        : [];
    }),
  );
  assert.equal(result.data?.title, "Anime");
  assert.equal(result.data?.episode, 12);
  assert.equal(result.data?.mediaType, "anime");
  assert.equal(result.data?.isActive, true);
  assert.ok(!JSON.stringify(result).includes("simkl-secret"));
});
test("Simkl marks history idle after 40 minutes and does not cache active status", async () => {
  const env = { SIMKL_CLIENT_ID: "aging", SIMKL_ACCESS_TOKEN: "token" };
  const d = deps((url) =>
    url.pathname.endsWith("activities")
      ? { all: "2026-10-07T11:20:01Z" }
      : url.searchParams.get("type") === "movies"
        ? [
            {
              watched_at: "2026-10-07T11:20:01Z",
              movie: { title: "Recent until now", ids: { simkl: 123 } },
            },
          ]
        : [],
  );
  assert.equal((await getSimkl(env, d)).data?.isActive, true);
  assert.equal(
    (await getSimkl(env, { ...d, now: () => now + 2000 })).data?.isActive,
    false,
  );
  assert.equal(
    (await getSimkl(env, { ...d, now: () => now + 1000 })).data?.isActive,
    false,
  );
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
        : url.searchParams.get("type") === "movies"
          ? [
              {
                watched_at: "2020-01-01T00:00:00Z",
                user_rated_at: "2026-10-07T11:00:00Z",
                movie: { title: "Old movie", ids: { simkl: 123 } },
              },
            ]
          : [],
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
      : url.searchParams.get("type") === "movies"
        ? [
            {
              watched_at: watchedAt,
              movie: { title: "Recent until now", ids: { simkl: 123 } },
            },
          ]
        : [],
  );
  const env = { SIMKL_CLIENT_ID: "boundary", SIMKL_ACCESS_TOKEN: "token" };
  assert.equal((await getSimkl(env, d)).state, "available");
  assert.equal(
    (await getSimkl(env, { ...d, now: () => now + 2000 })).state,
    "empty",
  );
});
