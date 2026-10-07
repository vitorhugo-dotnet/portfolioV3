import {
  fetchProviderJson,
  finiteNumber,
  record,
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
      return {
        state: "available",
        data: {
          isPlaying: true,
          game: safeText(player.gameextrainfo),
          appId: player.gameid,
          externalUrl: `https://store.steampowered.com/app/${player.gameid}/`,
        },
      };
    }
    const recent = await call(
      "IPlayerService/GetRecentlyPlayedGames/v1/",
      "steamid",
    );
    if (recent.games === undefined) return { state: "empty" };
    if (!Array.isArray(recent.games)) throw Error("Invalid Steam history");
    const game = recent.games
      .map(record)
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
    const icon =
      typeof game.img_icon_url === "string" &&
      /^[a-f0-9]{40}$/.test(game.img_icon_url)
        ? game.img_icon_url
        : undefined;
    return {
      state: "available",
      data: {
        isPlaying: false,
        game: safeText(game.name),
        appId,
        imageUrl: icon
          ? `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${icon}.jpg`
          : undefined,
        externalUrl: `https://store.steampowered.com/app/${appId}/`,
      },
    };
  } catch {
    return { state: "unavailable" };
  }
}
