import type {
  LiveActivityResponse,
  Provider,
  ProviderState,
} from "../../lib/live-activity.ts";
export interface Env {
  WAKATIME_API_KEY?: string;
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
  SPOTIFY_REFRESH_TOKEN?: string;
  SIMKL_CLIENT_ID?: string;
  SIMKL_ACCESS_TOKEN?: string;
  STEAM_API_KEY?: string;
  STEAM_ID?: string;
  ALLOWED_ORIGINS?: string;
  PAGES_PROJECT?: string;
  EXPOSE_CODING_PROJECT?: string;
  DEVELOPMENT?: string;
  ACTIVITY_MONITOR_ENABLED?: string;
  DISCORD_WEBHOOK_URL?: string;
  SPOTIFY_AUTHORIZED_AT?: string;
  ACTIVITY_MONITOR_STATE?: MonitorStateStore;
}
export interface MonitorStateStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}
export interface ProviderDependencies {
  fetch: typeof fetch;
  now: () => number;
}
export type CredentialProbeState =
  | "valid"
  | "invalid"
  | "transient"
  | "unconfigured";
export type CredentialProbeResult = {
  state: CredentialProbeState;
  reason?:
    | "invalid_token"
    | "invalid_client"
    | "unauthorized"
    | "provider_error";
};
export interface ProviderResult<K extends Provider> {
  state: ProviderState;
  data?: LiveActivityResponse[K];
}
