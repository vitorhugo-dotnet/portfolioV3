import {
  fetchProviderJson,
  finiteNumber,
  ProviderHttpError,
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
    const utcDay = new Date(deps.now()).toISOString().slice(0, 10);
    const headers = {
      Authorization: `Basic ${btoa(env.WAKATIME_API_KEY)}`,
    };
    const [heartbeatRaw, summaryRaw] = await Promise.all([
      fetchProviderJson(
        new URL(
          `https://api.wakatime.com/api/v1/users/current/heartbeats?date=${utcDay}`,
        ),
        { headers },
        deps,
      ),
      fetchProviderJson(
        new URL(
          `https://api.wakatime.com/api/v1/users/current/summaries?start=${utcDay}&end=${utcDay}`,
        ),
        { headers },
        deps,
      ),
    ]);
    const heartbeatResponse = record(heartbeatRaw);
    const summaries = record(summaryRaw).data;
    if (!Array.isArray(heartbeatResponse.data) || !Array.isArray(summaries))
      throw Error("Invalid coding payload");
    const summary = summaries[0] ? record(summaries[0]) : undefined;
    const summaryRange = summary?.range;
    const summaryTimezone =
      summaryRange && typeof summaryRange === "object"
        ? record(summaryRange).timezone
        : undefined;
    const timezone =
      (typeof heartbeatResponse.timezone === "string" &&
        heartbeatResponse.timezone) ||
      (typeof summaryTimezone === "string" && summaryTimezone) ||
      "UTC";
    const dateInTimezone = (time: number) => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(time);
      const part = (type: string) =>
        parts.find((item) => item.type === type)?.value;
      return `${part("year")}-${part("month")}-${part("day")}`;
    };
    const startOfWindowDay = dateInTimezone(deps.now() - 300000);
    const currentDay = dateInTimezone(deps.now());
    const dates = [...new Set([utcDay, currentDay, startOfWindowDay])];
    const heartbeats = [...heartbeatResponse.data];
    for (const date of dates) {
      if (date === utcDay) continue;
      const response = record(
        await fetchProviderJson(
          new URL(
            `https://api.wakatime.com/api/v1/users/current/heartbeats?date=${date}`,
          ),
          { headers },
          deps,
        ),
      );
      if (!Array.isArray(response.data)) throw Error("Invalid coding payload");
      heartbeats.push(...response.data);
    }
    const latest = heartbeats
      .map(record)
      .filter(
        (h) =>
          finiteNumber(h.time) !== undefined &&
          Number(h.time) * 1000 <= deps.now(),
      )
      .sort((a, b) => Number(b.time) - Number(a.time))[0];
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
  } catch (error) {
    console.error("provider_error", {
      provider: "wakatime",
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
