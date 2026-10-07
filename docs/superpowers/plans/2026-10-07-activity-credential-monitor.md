# Live Activity Credential Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Check WakaTime, Spotify, Simkl, and Steam credentials daily in the production Worker, notify Discord about invalid credentials and Spotify's expected expiration window, and deduplicate delivered alerts.

**Architecture:** Add provider-specific authenticated probes and reuse a testable Spotify refresh operation. A production-only scheduled Worker handler classifies results, sends Discord notifications, and records alert state in a Cloudflare KV namespace; the public activity endpoint stays unchanged.

**Tech Stack:** TypeScript, Cloudflare Workers scheduled events, Cloudflare KV, Wrangler, Node `node:test`, Biome.

**Spec:** [2026-10-07-spotify-token-monitor-design.md](../specs/2026-10-07-spotify-token-monitor-design.md)

## Global Constraints

- The public activity endpoint must not expose credentials, webhook URLs, or monitor state.
- Only production runs the daily monitor; preview sends no Discord notifications.
- Store provider names, alert-state identifiers, and the Spotify authorization timestamp in KV; never store credentials or webhook URLs.
- WakaTime, Simkl, and Steam HTTP 401/403, Spotify `invalid_grant`, and Spotify `invalid_client`/401 identify invalid credentials.
- Network failures, timeout, 429, 5xx, malformed data, and ambiguous errors are transient and must not create false invalid-credential or expiration alerts.
- Spotify age warning starts at 173 elapsed days; expected expiration warning starts at 180 days.
- Only send alert state to KV after Discord confirms delivery; successful probes clear the provider's invalid state.
- Keep tokens and Discord webhook values server-side; never put secrets in source, logs, public DTOs, or command arguments.

## Review Focus

- A provider returns 401/403 or Spotify returns `invalid_grant`: alert once, then suppress repeats until recovery (Tasks 2–3).
- A provider times out or returns 429/5xx: classify as transient and send no invalid-credential or expired alert (Tasks 1–3).
- One provider lacks credentials while others are configured: skip only that provider and continue checking configured providers (Task 2).
- Discord or KV fails: do not report delivery or expose payloads; retry unsent alert on a later run (Task 3).
- Spotify timestamp is missing, malformed, future, or exactly on day 173/180: skip age alerts for invalid timestamps and apply exact inclusive boundaries (Tasks 1 and 3).

## File Map

- `worker/src/providers/spotify.ts`: share the token refresh exchange with monitoring and preserve the current activity behavior.
- `worker/src/credential-probes.ts`: probe configured provider credentials and return valid, invalid, transient, or unconfigured outcomes.
- `worker/src/credential-monitor.ts`: apply Spotify age stages, deduplicate alerts through an injected KV interface, and post sanitized Discord messages.
- `worker/src/types.ts`: add monitor configuration and minimal KV binding interfaces.
- `worker/src/index.ts`: wire the production scheduled event while preserving `fetch` behavior.
- `worker/wrangler.jsonc`: declare the daily production cron, production enablement, and KV binding; leave preview monitoring disabled.
- `tests/live-activity-providers.test.ts`, `tests/activity-credential-monitor.test.ts`: add deterministic provider-probe, classification, alert, and deduplication coverage.
- `tests/live-activity-worker.test.ts`: verify the scheduled entrypoint wiring without changing public HTTP behavior.
- `README.md`: document the KV namespace, `SPOTIFY_AUTHORIZED_AT`, `DISCORD_WEBHOOK_URL`, provider secrets, and production setup.

### Task 1: Spotify refresh result and expiration classification

**Files:** `worker/src/providers/spotify.ts`; `worker/src/spotify-token.ts` (create); `tests/live-activity-providers.test.ts`.

**Interfaces:** `refreshSpotifyToken(env: Env, deps: ProviderDependencies, options?: { force?: boolean }): Promise<string>` obtains and caches an access token; `{ force: true }` bypasses cache for the existing one-time 401 retry. It throws `SpotifyTokenError` with a safe `code?: string` and `status?: number`; it never stores raw response bodies or credentials on the error. `spotifyAgeStage(authorizedAt: string | undefined, now: number): "warning" | "expired" | undefined` is implemented in `worker/src/spotify-token.ts`, uses elapsed UTC milliseconds, and returns `warning` for age >=173 and <180 days, `expired` for age >=180 days, otherwise undefined; invalid or future timestamps return undefined.

- [x] Write tests proving `invalid_grant`, `invalid_client`, HTTP 401, HTTP 429, 5xx, timeout, and malformed success payloads produce the appropriate safe typed result; verify valid token refresh continues to work in `getSpotify`.
- [x] Write age-stage tests for 172d23h, exactly 173 days, 179d23h, exactly 180 days, future, malformed, and absent timestamps.
- [x] Run `node --experimental-strip-types --test tests/live-activity-providers.test.ts`; confirm the new tests fail.
- [x] Extract the Spotify token exchange into `worker/src/spotify-token.ts`; make `getSpotify` call the shared function and preserve its in-memory access-token cache and one-time 401 retry.
- [x] Implement `spotifyAgeStage` in `worker/src/spotify-token.ts` with the interface above.
- [x] Rerun the focused tests and `npm run typecheck:worker`; confirm Spotify activity tests and age-stage tests pass. Commit: `refactor: expose typed Spotify refresh checks`.

### Task 2: Authenticated probes for every activity provider

**Files:** `worker/src/credential-probes.ts` (create); `worker/src/types.ts`; `tests/activity-credential-monitor.test.ts`.

**Interfaces:** `probeActivityCredentials(env: Env, deps: ProviderDependencies): Promise<Record<"coding" | "spotify" | "simkl" | "steam", CredentialProbeResult>>`, where `CredentialProbeResult` is `{ state: "valid" | "invalid" | "transient" | "unconfigured"; reason?: "invalid_token" | "invalid_client" | "unauthorized" | "provider_error" }`. Never include response bodies, credentials, or URLs in results.

- [x] Write fake-fetch tests for WakaTime `/api/v1/users/current`, Spotify refresh exchange, Simkl `/sync/activities`, and Steam `ISteamUser/GetPlayerSummaries`; verify correct auth headers/query fields without returning secrets in results.
- [x] Test 401/403 invalid classification for WakaTime, Simkl, and Steam; Spotify `invalid_grant`, `invalid_client`, and 401 invalid classification; classify 429, 5xx, timeout, invalid JSON, and unexpected 4xx as transient.
- [x] Test each missing/incomplete provider configuration returns `unconfigured` for that provider while still probing the remaining configured providers.
- [x] Run `node --experimental-strip-types --test tests/activity-credential-monitor.test.ts`; confirm the new tests fail.
- [x] Implement provider-specific probes with five-second aborts and official HTTPS endpoints; query no playback/history data beyond the minimum authenticated validity probe.
- [x] Rerun focused tests and `npm run typecheck:worker`; confirm no secrets occur in serialized probe results. Commit: `feat: check credentials for all activity providers`.

### Task 3: Daily monitor, Discord delivery, and KV deduplication

**Files:** `worker/src/credential-monitor.ts` (create); `worker/src/types.ts`; `tests/activity-credential-monitor.test.ts`.

**Interfaces:** `runCredentialMonitor(env: Env, deps: ProviderDependencies & { state?: MonitorStateStore }): Promise<void>`. `MonitorStateStore` exposes `get(key: string): Promise<string | null>`, `put(key: string, value: string): Promise<void>`, and `delete(key: string): Promise<void>`. `runCredentialMonitor` skips all provider/network work if monitoring is disabled, Discord webhook is absent, or the state binding is absent; if enabled, it probes configured providers, posts sanitized provider-specific invalid-credential alerts, posts Spotify age-stage notices only when the Spotify refresh succeeded, and updates KV only after successful webhook delivery.

- [ ] Write tests for first invalid alert, duplicate suppression, invalid-to-valid recovery clearing, transient retaining existing state without a false alert, separate alerts per provider, and Spotify `invalid_grant` alerting.
- [ ] Write tests for age warning and expiration notifications, one notification per authorization timestamp/stage, missing/invalid timestamp, monitor disabled/missing webhook, Discord non-2xx/network failure, and KV read/write/delete failures.
- [ ] Run `node --experimental-strip-types --test tests/activity-credential-monitor.test.ts`; confirm the new tests fail.
- [ ] Implement deterministic KV keys based on provider and Spotify authorization timestamp/stage; do not include secret-derived values. POST short plain-text messages to Discord with `wait=true`, timeout, and no logging of the webhook URL or response body.
- [ ] Ensure transient Spotify probe results suppress date-based expiration claims; only a successful refresh qualifies for age-stage notification.
- [ ] Rerun focused tests and `npm run typecheck:worker`; confirm delivery failures leave alerts eligible for retry. Commit: `feat: alert on invalid activity credentials`.

### Task 4: Scheduled Worker configuration and operational instructions

**Files:** `worker/src/index.ts`; `worker/src/types.ts`; `worker/wrangler.jsonc`; `tests/live-activity-worker.test.ts`; `README.md`.

**Interfaces:** The Worker default export retains `fetch(request, env, ctx)` and adds `scheduled(controller, env, ctx)`. Scheduled execution injects `globalThis.fetch`, `Date.now`, and the `ACTIVITY_MONITOR_STATE` KV binding into `runCredentialMonitor`. Production cron is `0 6 * * *`; preview has no cron and has `ACTIVITY_MONITOR_ENABLED` false.

- [ ] Add a scheduled-entrypoint test that invokes a fake controller and confirms the injected time, KV binding, and monitor function are used; retain existing fetch route/CORS/cache tests unchanged.
- [ ] Run `node --experimental-strip-types --test tests/live-activity-worker.test.ts`; confirm the new scheduled test fails.
- [ ] Configure the daily production trigger, monitor enablement, and KV binding in Wrangler; do not add a cron to preview. Keep public fetch behavior untouched.
- [ ] Document how to create/bind the production KV namespace and set `ACTIVITY_MONITOR_ENABLED`, `SPOTIFY_AUTHORIZED_AT`, and `DISCORD_WEBHOOK_URL` using Cloudflare dashboard/interactive secret setup. Clarify that each provider probe runs only when its existing credentials are configured.
- [ ] Run `npm run ci`, `npm run typecheck`, `npm run typecheck:worker`, `npm test`, `npm run worker:check`, and `npm run build`; inspect the diff for secret leakage. Commit: `feat: schedule production activity credential monitoring`.

## Integration

- [ ] Review the complete diff, verify the working tree is clean, and ensure all validation commands pass.
- [ ] Push the verified commits to `main` using the existing user authorization; do not force push.
