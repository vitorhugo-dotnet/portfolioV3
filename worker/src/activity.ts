import type { LiveActivityResponse } from "../../lib/live-activity.ts";
import { getSimkl } from "./providers/simkl.ts";
import { getSpotify } from "./providers/spotify.ts";
import { getSteam } from "./providers/steam.ts";
import { getCoding } from "./providers/wakatime.ts";
import type { Env, ProviderDependencies } from "./types.ts";

export async function collectActivity(
  env: Env,
  deps: ProviderDependencies,
): Promise<LiveActivityResponse> {
  const results = await Promise.allSettled([
    getCoding(env, deps),
    getSpotify(env, deps),
    getSimkl(env, deps),
    getSteam(env, deps),
  ]);
  const [coding, spotify, simkl, steam] = results.map((r) =>
    r.status === "fulfilled" ? r.value : { state: "unavailable" as const },
  );
  return {
    generatedAt: new Date(deps.now()).toISOString(),
    providerStates: {
      coding: coding.state,
      spotify: spotify.state,
      simkl: simkl.state,
      steam: steam.state,
    },
    coding: coding.data as LiveActivityResponse["coding"],
    spotify: spotify.data as LiveActivityResponse["spotify"],
    simkl: simkl.data as LiveActivityResponse["simkl"],
    steam: steam.data as LiveActivityResponse["steam"],
  };
}
