export const providers = ["coding", "spotify", "simkl", "steam"] as const;
export type Provider = (typeof providers)[number];
export type ProviderState =
  | "available"
  | "empty"
  | "unavailable"
  | "unconfigured";
type Observation = { observedAt?: string };
export interface LiveActivityResponse {
  generatedAt: string;
  providerStates: Record<Provider, ProviderState>;
  coding?: Observation & {
    status: "active" | "idle";
    project?: string;
    language?: string;
    editor?: string;
    file?: string;
    durationMinutes?: number;
  };
  spotify?: Observation & {
    isPlaying: boolean;
    track?: string;
    artist?: string;
    album?: string;
    artworkUrl?: string;
    externalUrl?: string;
  };
  simkl?: Observation & {
    mediaType: "anime" | "tv" | "movie";
    title: string;
    episode?: number;
    isActive: boolean;
    posterUrl?: string;
    externalUrl?: string;
  };
  steam?: Observation & {
    isPlaying: boolean;
    game?: string;
    appId?: string;
    imageUrl?: string;
    externalUrl?: string;
  };
}
export function parseLiveActivity(value: unknown): LiveActivityResponse | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (
    typeof data.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(data.generatedAt)) ||
    !data.providerStates ||
    typeof data.providerStates !== "object"
  )
    return null;
  const states = data.providerStates as Record<string, unknown>;
  for (const provider of providers) {
    if (
      !["available", "empty", "unavailable", "unconfigured"].includes(
        String(states[provider]),
      )
    )
      return null;
    const item = data[provider];
    if (states[provider] === "available" && (!item || typeof item !== "object"))
      return null;
    if (item !== undefined) {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      if (
        entry.observedAt !== undefined &&
        (typeof entry.observedAt !== "string" ||
          !Number.isFinite(Date.parse(entry.observedAt)))
      )
        return null;
      if (
        provider === "coding" &&
        !["active", "idle"].includes(String(entry.status))
      )
        return null;
      if (
        (provider === "spotify" || provider === "steam") &&
        typeof entry.isPlaying !== "boolean"
      )
        return null;
      if (
        provider === "simkl" &&
        (!["anime", "tv", "movie"].includes(String(entry.mediaType)) ||
          typeof entry.title !== "string" ||
          typeof entry.isActive !== "boolean")
      )
        return null;
      for (const [key, field] of Object.entries(entry)) {
        if (["durationMinutes", "episode"].includes(key)) {
          if (typeof field !== "number" || !Number.isFinite(field) || field < 0)
            return null;
        } else if (
          ["isPlaying", "isActive"].includes(key)
            ? typeof field !== "boolean"
            : typeof field !== "string"
        )
          return null;
        if (key.endsWith("Url") && typeof field === "string") {
          try {
            const url = new URL(field);
            if (url.protocol !== "https:" || url.username || url.password)
              return null;
          } catch {
            return null;
          }
        }
      }
    }
  }
  return value as LiveActivityResponse;
}
