import type { ProviderDependencies } from "./types.ts";
export class ProviderHttpError extends Error {
  status: number;
  constructor(status: number) {
    super("Provider request failed");
    this.status = status;
  }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid provider payload");
  return value as Record<string, unknown>;
}
export function safeText(value: unknown): string | undefined {
  return typeof value === "string"
    ? value
        // biome-ignore lint/suspicious/noControlCharactersInRegex: remove unsafe control characters from provider text.
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .trim()
        .slice(0, 200) || undefined
    : undefined;
}
export function safeHttpsUrl(
  value: unknown,
  allowedHosts: readonly string[],
): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      allowedHosts.includes(url.hostname)
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export async function fetchProviderJson(
  url: URL,
  init: RequestInit,
  deps: ProviderDependencies,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await deps.fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: "manual",
    });
    if (!response.ok) throw new ProviderHttpError(response.status);
    if (response.status === 204) return null;
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
export function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}
export function timestamp(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const date = new Date(typeof value === "number" ? value * 1000 : value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}
