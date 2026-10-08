import {
  fetchProviderJson,
  finiteNumber,
  record,
  safeHttpsUrl,
  safeText,
} from "../provider-http.ts";
import type { Env, ProviderDependencies, ProviderResult } from "../types.ts";

export async function getSteam(
  env: Env,
  deps: ProviderDependencies,
): Promise<ProviderResult<"steam">> {
  if (!env.STEAM_API_KEY || !env.STEAM_ID || !/^\d{17}$/.test(env.STEAM_ID))
    return { state: "unconfigured" };
  try {
    const call = async (path: string, idKey: string) => {
      const url = new URL(`https://api.steampowered.com/${path}`);
      url.searchParams.set("key", env.STEAM_API_KEY as string);
      url.searchParams.set(idKey, env.STEAM_ID as string);
      return record(record(await fetchProviderJson(url, {}, deps)).response);
    };
    const recentGames = async () => {
      const recent = await call(
        "IPlayerService/GetRecentlyPlayedGames/v1/",
        "steamid",
      );
      return Array.isArray(recent.games) ? recent.games.map(record) : [];
    };
    const coverFor = async (appId: string) => {
      try {
        const url = new URL("https://store.steampowered.com/api/appdetails");
        url.searchParams.set("appids", appId);
        const payload = record(await fetchProviderJson(url, {}, deps));
        const app = record(payload[appId]);
        if (app.success !== true) return undefined;
        const details = record(app.data);
        return safeHttpsUrl(details.header_image, [
          "shared.akamai.steamstatic.com",
          "cdn.akamai.steamstatic.com",
        ]);
      } catch {
        return undefined;
      }
    };
    const summaries = await call(
      "ISteamUser/GetPlayerSummaries/v2/",
      "steamids",
    );
    if (!Array.isArray(summaries.players)) throw Error("Invalid Steam player");
    const player = summaries.players[0]
      ? record(summaries.players[0])
      : undefined;
    if (!player) return { state: "empty" };
    if (
      typeof player.gameid === "string" &&
      /^\d{1,10}$/.test(player.gameid) &&
      safeText(player.gameextrainfo)
    ) {
      const appId = player.gameid;
      const [games, coverUrl] = await Promise.all([
        recentGames().catch(() => []),
        coverFor(appId),
      ]);
      const game = games.find((item) => String(item.appid) === appId);
      return {
        state: "available",
        data: {
          isPlaying: true,
          game: safeText(player.gameextrainfo),
          appId,
          totalPlaytimeMinutes: finiteNumber(game?.playtime_forever),
          coverUrl,
          externalUrl: `https://store.steampowered.com/app/${appId}/`,
        },
      };
    }
    const games = await recentGames();
    if (!games.length) return { state: "empty" };
    const game = games
      .filter(
        (g) =>
          Number.isSafeInteger(g.appid) &&
          Number(g.appid) > 0 &&
          safeText(g.name),
      )
      .sort(
        (a, b) =>
          (finiteNumber(b.playtime_2weeks) ?? 0) -
            (finiteNumber(a.playtime_2weeks) ?? 0) ||
          Number(a.appid) - Number(b.appid),
      )[0];
    if (!game) return { state: "empty" };
    const appId = String(game.appid);
    const coverUrl = await coverFor(appId);
    return {
      state: "available",
      data: {
        isPlaying: false,
        game: safeText(game.name),
        appId,
        totalPlaytimeMinutes: finiteNumber(game.playtime_forever),
        coverUrl,
        externalUrl: `https://store.steampowered.com/app/${appId}/`,
      },
    };
  } catch {
    return { state: "unavailable" };
  }
}
