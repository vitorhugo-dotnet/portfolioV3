import { collectActivity } from "./activity.ts";
import { runCredentialMonitor } from "./credential-monitor.ts";
import type {
  Env,
  ProviderDependencies,
  ScheduledControllerLike,
} from "./types.ts";

interface ActivityCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}
interface Context {
  waitUntil(promise: Promise<unknown>): void;
}
function allowedOrigin(origin: string | null, env: Env): string | undefined {
  if (!origin) return undefined;
  try {
    const url = new URL(origin);
    if (url.origin !== origin || url.username || url.password) return undefined;
    if (
      env.DEVELOPMENT === "true" &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
      return origin;
    if (url.protocol !== "https:" || url.port) return undefined;
    if (
      (env.ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((s) => s.trim())
        .includes(origin)
    )
      return origin;
    if (
      env.PAGES_PROJECT &&
      /^[a-z0-9][a-z0-9-]{0,57}[a-z0-9]$/.test(env.PAGES_PROJECT)
    ) {
      const root = `${env.PAGES_PROJECT}.pages.dev`;
      if (
        url.hostname === root ||
        (url.hostname.endsWith(`.${root}`) &&
          !url.hostname.slice(0, -(root.length + 1)).includes("."))
      )
        return origin;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
export function createActivityHandler(
  deps: ProviderDependencies & {
    cache: ActivityCache;
    collect: typeof collectActivity;
  },
) {
  return async (
    request: Request,
    env: Env,
    ctx: Context,
  ): Promise<Response> => {
    const url = new URL(request.url);
    const headers = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      Vary: "Origin",
    });
    const origin = allowedOrigin(request.headers.get("Origin"), env);
    if (origin) headers.set("Access-Control-Allow-Origin", origin);
    if (url.pathname !== "/api/activity")
      return new Response('{"error":"Not found"}', { status: 404, headers });
    if (!["GET", "OPTIONS"].includes(request.method)) {
      headers.set("Allow", "GET, OPTIONS");
      return new Response('{"error":"Method not allowed"}', {
        status: 405,
        headers,
      });
    }
    if (request.method === "OPTIONS") {
      headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      headers.set("Access-Control-Max-Age", "600");
      return new Response(null, { status: origin ? 204 : 403, headers });
    }
    const key = new Request(`${url.origin}/api/activity`);
    let cached: Response | undefined;
    try {
      cached = await deps.cache.match(key);
    } catch {
      /* Cache is an optimization. */
    }
    if (!cached) {
      const data = await deps.collect(env, deps);
      cached = Response.json(data, {
        headers: { "Cache-Control": "public, max-age=60" },
      });
      ctx.waitUntil(deps.cache.put(key, cached.clone()).catch(() => {}));
    }
    headers.set("Cache-Control", "public, max-age=60");
    return new Response(cached.body, { status: 200, headers });
  };
}
export default {
  fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
    const cache = (caches as unknown as { default: ActivityCache }).default;
    return createActivityHandler({
      fetch: (input, init) => globalThis.fetch(input, init),
      now: Date.now,
      cache,
      collect: collectActivity,
    })(request, env, ctx);
  },
  scheduled(
    _controller: ScheduledControllerLike,
    env: Env,
    ctx: Context,
  ): void {
    ctx.waitUntil(
      runCredentialMonitor(env, {
        fetch: (input, init) => globalThis.fetch(input, init),
        now: Date.now,
      }).catch(() => {
        console.error("activity_monitor_error", { operation: "scheduled" });
      }),
    );
  },
};
