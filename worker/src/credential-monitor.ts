import { probeActivityCredentials } from "./credential-probes.ts";
import { getSimklRefreshExpiry, simklRefreshAgeStage } from "./simkl-oauth.ts";
import { spotifyAgeStage } from "./spotify-token.ts";
import type { Env, ProviderDependencies } from "./types.ts";

const providerLabels = {
  coding: "WakaTime",
  spotify: "Spotify",
  simkl: "Simkl",
  steam: "Steam",
} as const;

function checkedDiscordWebhook(value: string | undefined): URL | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "discord.com" &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/api\/webhooks\/\d+\/[\w.-]+$/.test(url.pathname)
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}

async function sendDiscord(
  url: URL,
  message: string,
  deps: ProviderDependencies,
): Promise<boolean> {
  const webhook = new URL(url);
  webhook.searchParams.set("wait", "true");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await deps.fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: message,
        allowed_mentions: { parse: [] },
      }),
      signal: controller.signal,
      redirect: "manual",
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function notifyOnce(
  env: Env,
  deps: ProviderDependencies,
  webhook: URL,
  key: string,
  value: string,
  message: string,
): Promise<void> {
  const state = env.ACTIVITY_MONITOR_STATE;
  if (!state) return;
  let previous: string | null;
  try {
    previous = await state.get(key);
  } catch {
    console.error("activity_monitor_error", { operation: "state_read" });
    return;
  }
  if (previous === value) return;
  if (!(await sendDiscord(webhook, message, deps))) {
    console.error("activity_monitor_error", { operation: "notification" });
    return;
  }
  try {
    await state.put(key, value);
  } catch {
    console.error("activity_monitor_error", { operation: "state_write" });
  }
}

async function clearInvalidState(env: Env, provider: string): Promise<void> {
  const key = `activity-monitor:credential:${provider}`;
  const state = env.ACTIVITY_MONITOR_STATE;
  if (!state) return;
  try {
    if ((await state.get(key)) !== null) await state.delete(key);
  } catch {
    console.error("activity_monitor_error", { operation: "state_clear" });
  }
}

function invalidCredentialMessage(
  provider: keyof typeof providerLabels,
  reason: string | undefined,
): string {
  if (provider === "spotify" && reason === "invalid_token")
    return "🚨 Spotify refresh token inválido ou revogado. Reautorize para restaurar a atividade.";
  if (provider === "spotify" && reason === "invalid_client")
    return "🚨 Credenciais do aplicativo Spotify inválidas. Verifique client ID e secret.";
  return `🚨 Credencial ${providerLabels[provider]} inválida. Verifique a configuração para restaurar a atividade.`;
}

export async function runCredentialMonitor(
  env: Env,
  deps: ProviderDependencies,
): Promise<void> {
  const webhook = checkedDiscordWebhook(env.DISCORD_WEBHOOK_URL);
  const state = env.ACTIVITY_MONITOR_STATE;
  if (env.ACTIVITY_MONITOR_ENABLED !== "true" || !webhook || !state) return;

  const results = await probeActivityCredentials(env, deps);
  let simklRefreshExpiry: number | undefined;
  try {
    simklRefreshExpiry = await getSimklRefreshExpiry(env);
  } catch {
    // Token-age alerts are best-effort; credential probes report auth failures.
  }
  const simklAgeStage = simklRefreshAgeStage(simklRefreshExpiry, deps.now());
  for (const provider of ["coding", "spotify", "simkl", "steam"] as const) {
    const result = results[provider];
    if (result.state === "valid") {
      await clearInvalidState(env, provider);
    } else if (
      result.state === "invalid" &&
      !(
        provider === "simkl" &&
        result.reason === "invalid_token" &&
        simklAgeStage === "expired"
      )
    ) {
      await notifyOnce(
        env,
        deps,
        webhook,
        `activity-monitor:credential:${provider}`,
        "invalid",
        invalidCredentialMessage(provider, result.reason),
      );
    }
  }

  const spotify = results.spotify;
  const ageStage =
    spotify.state === "valid"
      ? spotifyAgeStage(env.SPOTIFY_AUTHORIZED_AT, deps.now())
      : undefined;
  if (ageStage && env.SPOTIFY_AUTHORIZED_AT) {
    const message =
      ageStage === "warning"
        ? "⚠️ Spotify token expira em aproximadamente 7 dias"
        : "🚨 Spotify token deve estar expirado";
    await notifyOnce(
      env,
      deps,
      webhook,
      "activity-monitor:spotify-age",
      `${env.SPOTIFY_AUTHORIZED_AT}:${ageStage}`,
      message,
    );
  }

  if (!simklAgeStage || simklRefreshExpiry === undefined) return;
  const simkl = results.simkl;
  if (
    simkl.state === "unconfigured" ||
    (simkl.state === "invalid" &&
      (simklAgeStage !== "expired" || simkl.reason !== "invalid_token"))
  )
    return;
  const simklAgeMessage =
    simklAgeStage === "warning"
      ? "⚠️ Simkl refresh token expira em aproximadamente 7 dias"
      : "🚨 Simkl refresh token expirou. Reautorize para restaurar a atividade.";
  await notifyOnce(
    env,
    deps,
    webhook,
    "activity-monitor:simkl-refresh-age",
    `${simklRefreshExpiry}:${simklAgeStage}`,
    simklAgeMessage,
  );
}
