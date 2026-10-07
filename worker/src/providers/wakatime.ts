import {
  fetchProviderJson,
  finiteNumber,
  record,
  safeText,
  timestamp,
} from "../provider-http.ts";
import type { Env, ProviderDependencies, ProviderResult } from "../types.ts";

export async function getCoding(
  env: Env,
  deps: ProviderDependencies,
): Promise<ProviderResult<"coding">> {
  if (!env.WAKATIME_API_KEY) return { state: "unconfigured" };
  try {
    const day = new Date(deps.now()).toISOString().slice(0, 10);
    const headers = {
      Authorization: `Basic ${btoa(`${env.WAKATIME_API_KEY}:`)}`,
    };
    const [heartbeatRaw, summaryRaw] = await Promise.all([
      fetchProviderJson(
        new URL(
          `https://api.wakatime.com/api/v1/users/current/heartbeats?date=${day}`,
        ),
        { headers },
        deps,
      ),
      fetchProviderJson(
        new URL(
          `https://api.wakatime.com/api/v1/users/current/summaries?start=${day}&end=${day}`,
        ),
        { headers },
        deps,
      ),
    ]);
    const heartbeats = record(heartbeatRaw).data;
    const summaries = record(summaryRaw).data;
    if (!Array.isArray(heartbeats) || !Array.isArray(summaries))
      throw Error("Invalid coding payload");
    const latest = heartbeats
      .map(record)
      .filter((h) => finiteNumber(h.time) !== undefined)
      .sort((a, b) => Number(b.time) - Number(a.time))[0];
    const summary = summaries[0] ? record(summaries[0]) : undefined;
    if (!latest && !summary) return { state: "empty" };
    const age = latest ? deps.now() - Number(latest.time) * 1000 : Infinity;
    const topName = (value: unknown) =>
      Array.isArray(value) && value[0]
        ? safeText(record(value[0]).name)
        : undefined;
    const seconds = summary?.grand_total
      ? finiteNumber(record(summary.grand_total).total_seconds)
      : undefined;
    return {
      state: "available",
      data: {
        status: age >= 0 && age <= 300000 ? "active" : "idle",
        observedAt: latest && age >= 0 ? timestamp(latest.time) : undefined,
        language: safeText(latest?.language) ?? topName(summary?.languages),
        editor: safeText(latest?.editor) ?? topName(summary?.editors),
        project:
          env.EXPOSE_CODING_PROJECT === "true"
            ? safeText(latest?.project)
            : undefined,
        durationMinutes:
          seconds === undefined ? undefined : Math.round(seconds / 60),
      },
    };
  } catch {
    return { state: "unavailable" };
  }
}
