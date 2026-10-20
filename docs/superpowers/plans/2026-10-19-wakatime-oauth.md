# WakaTime OAuth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace WakaTime API-key reads in the portfolio activity Worker with single-user OAuth bearer reads and safely refreshed, rotated tokens.

**Architecture:** Add a WakaTime OAuth token module and SQLite-backed Durable Object modeled on the existing Simkl token store. The provider and credential monitor obtain access tokens through that module, while a local authorization-code script provisions the initial refresh token. Update Worker bindings and migration instructions without changing the public activity response.

**Tech Stack:** TypeScript, Cloudflare Workers, SQLite-backed Durable Objects, Node.js setup script, Node test runner, Wrangler.

**Spec:** `docs/superpowers/specs/2026-10-19-wakatime-oauth-design.md`

## Global Constraints

- OAuth authorization requests `read_summaries` and `read_heartbeats` only.
- WakaTime API requests use `Authorization: Bearer <access_token>`.
- The OAuth client secret and access/refresh tokens stay server-side and out of logs, client responses, and URLs. Only the public client ID and one-time authorization code use standard OAuth URLs; the setup script keeps the callback local and does not log it.
- The existing portfolio activity endpoint, normalized response, and other providers remain unchanged.
- OAuth refresh operations are serialized for the single WakaTime account.
- Missing configuration is unconfigured; auth rejection is invalid; ambiguous/provider failures are transient or unavailable.

## Review Focus

- Malformed or partial token responses must not overwrite a usable stored grant; test that storage remains unchanged.
- Concurrent reads must not submit the same rotating refresh token in parallel; test serialized Durable Object requests.
- A rotated refresh token must survive the first successful refresh and be used on the next refresh; test persisted token replacement and subsequent request body.
- A rejected API bearer token must trigger at most one forced refresh and one retry; test successful retry and second rejection.
- WakaTime error bodies and thrown network errors may contain credentials; test sanitized errors and monitor results never include access or refresh tokens.

---

### Task 1: WakaTime OAuth token storage and refresh

**Files:**
- Create: `worker/src/wakatime-oauth.ts`
- Modify: `worker/src/types.ts`
- Modify: `worker/src/index.ts`
- Test: `tests/wakatime-oauth.test.ts`

**Interfaces:**
- Consumes: `Env`, `ProviderDependencies` from `worker/src/types.ts`; Cloudflare Durable Object storage shape used by `SimklTokenStore` in `worker/src/simkl-oauth.ts`.
- Produces: `getWakaTimeAccessToken(env: Env, options?: { force?: boolean }): Promise<string>`, `WakaTimeTokenError` with sanitized `code` and `status`, and `WakaTimeTokenStore` Durable Object. The store exposes only `POST /access-token` and returns `{ access_token }` on success; errors return `{ error }` without token data.

- [x] **Step 1: Write focused failing token tests** named `refreshes and persists initial tokens`, `reuses an unexpired access token`, `refreshes before expiry`, `persists rotated refresh tokens`, `forces refresh when requested`, `preserves state after malformed or failed refresh`, `serializes concurrent refreshes`, and `store never returns refresh tokens`.
- [x] **Step 2: Run `node --experimental-strip-types --test tests/wakatime-oauth.test.ts` and confirm the tests fail because the module and exports are absent.**
- [x] **Step 3: Implement the token helper and `WakaTimeTokenStore` in `worker/src/wakatime-oauth.ts`.** Use `https://wakatime.com/oauth/token`, form-encoded `client_id`, `client_secret`, `grant_type`, and `refresh_token`; require nonempty `access_token`, nonempty `refresh_token`, and positive finite `expires_in`; cache until 60 seconds before expiry; persist the full next token pair before returning; serialize Durable Object requests with `blockConcurrencyWhile`; never return or log tokens from the object.
- [x] **Step 4: Add `WAKATIME_CLIENT_ID`, `WAKATIME_CLIENT_SECRET`, `WAKATIME_REFRESH_TOKEN`, and `WAKATIME_TOKEN_STORE` to `Env`; export `WakaTimeTokenStore` from `worker/src/index.ts`; run `node --experimental-strip-types --test tests/wakatime-oauth.test.ts` and confirm all tests pass.**
- [x] **Step 5: Run `npm run typecheck:worker` and fix any type errors.**
- [x] **Step 6: Commit the token-store implementation and tests.**

### Task 2: Migrate live WakaTime reads and credential monitoring

**Files:**
- Modify: `worker/src/providers/wakatime.ts`
- Modify: `worker/src/credential-probes.ts`
- Test: `tests/live-activity-providers.test.ts`
- Test: `tests/activity-credential-monitor.test.ts`

**Interfaces:**
- Consumes: `getWakaTimeAccessToken` and `WakaTimeTokenError` from Task 1.
- Produces: `getCoding(env, deps)` uses OAuth for heartbeat and summary reads, including one forced refresh and one retry on 401/403. `probeActivityCredentials` validates WakaTime by obtaining a token and querying `GET https://api.wakatime.com/api/v1/users/current`.

- [x] **Step 1: Replace the existing Basic-auth assertion with failing bearer-auth assertions** covering both existing endpoints, existing date parameters, refresh-token acquisition, one retry after unauthorized, no retry loop after a second unauthorized, unconfigured behavior, and unchanged public DTO redaction.
- [x] **Step 2: Add failing credential-probe assertions** for OAuth success, invalid grant/unauthorized classification, transient network/provider failure, and token redaction.
- [x] **Step 3: Run `node --experimental-strip-types --test tests/live-activity-providers.test.ts tests/activity-credential-monitor.test.ts` and confirm the relevant tests fail against the old API-key flow.**
- [x] **Step 4: Update `getCoding` to obtain a bearer token and retry a failed API request once after forcing refresh.** Keep all heartbeat selection, summary normalization, filename masking, and error output sanitized.
- [x] **Step 5: Replace `probeWakaTime(apiKey, deps)` with an environment-based OAuth probe using the shared token helper; classify `invalid_grant`, 401/403, and transient failures without embedding provider response bodies.**
- [x] **Step 6: Run the two focused test files and confirm all relevant tests pass.**
- [x] **Step 7: Commit the provider and monitor migration.**

### Task 3: Configure the Worker and add local OAuth bootstrap

**Files:**
- Modify: `worker/wrangler.jsonc`
- Create: `scripts/wakatime-auth.ts`
- Test: `tests/wakatime-auth.test.ts`

**Interfaces:**
- Consumes: WakaTime authorization-code parameters and token response documented in the approved spec; existing script conventions from `scripts/simkl-auth.ts`.
- Produces: `createWakaTimeAuthorizationRequest(clientId, redirectUri)` returns `{ url, state }`; `parseWakaTimeOAuthCallback(callbackUrl, redirectUri, expectedState)` returns a validated authorization code; `exchangeWakaTimeAuthorizationCode({ clientId, clientSecret, redirectUri, code }, fetcher?)` returns only `{ refreshToken }`; script prints only the initial refresh token and Worker secret commands.

- [x] **Step 1: Write failing tests** for authorization URL scopes (`read_summaries read_heartbeats`), response type, client ID, redirect URI, state validation, callback origin/path validation, OAuth error, missing code, token exchange fields, and output redaction.
- [x] **Step 2: Run `node --experimental-strip-types --test tests/wakatime-auth.test.ts` and confirm expected failures.**
- [x] **Step 3: Implement the local script with cryptographically random state, exact redirect URI matching, manual-redirect HTTPS token exchange, timeout, and sanitized failures.** Read `WAKATIME_CLIENT_ID`, `WAKATIME_CLIENT_SECRET`, and `WAKATIME_REDIRECT_URI` only from the local environment. Do not emit the access token or client secret.
- [x] **Step 4: Add a `new_sqlite_classes` migration for `WakaTimeTokenStore` and bind `WAKATIME_TOKEN_STORE` in preview and production in `worker/wrangler.jsonc`.**
- [x] **Step 5: Run `node --experimental-strip-types --test tests/wakatime-auth.test.ts` and `npm run worker:check`; confirm tests and both Wrangler dry runs pass.**
- [x] **Step 6: Commit the bootstrap flow and Worker configuration.**

### Task 4: Update credential setup and run full verification

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-10-07-live-activity-design.md`
- Modify: `docs/superpowers/specs/2026-10-07-spotify-token-monitor-design.md`
- Modify: `docs/superpowers/plans/2026-10-07-live-activity.md`
- Modify: `docs/superpowers/plans/2026-10-07-activity-credential-monitor.md`
- Modify: `docs/superpowers/specs/2026-10-19-wakatime-oauth-design.md`
- Modify: `scripts/wakatime-auth.ts`
- Modify: `tests/wakatime-auth.test.ts`
- Modify: `tests/wakatime-oauth.test.ts`
- Modify: `tests/activity-credential-monitor.test.ts`

**Interfaces:**
- Consumes: the bootstrap script and Worker bindings from Task 3.
- Produces: documented app registration, OAuth authorization, secret setup for preview and production, removal of `WAKATIME_API_KEY`, and migration guidance for existing deployments.

- [x] **Step 1: Update README credential commands** to remove `WAKATIME_API_KEY`, set `WAKATIME_CLIENT_ID` and `WAKATIME_CLIENT_SECRET` as Worker secrets in each environment, run the local authorization script separately for preview and production, set each distinct `WAKATIME_REFRESH_TOKEN`, and describe that OAuth client ID, secret, redirect URI, and environment are configured locally.
- [x] **Step 2: Update the historical live-activity design and plan** to describe OAuth credentials and token storage instead of the obsolete API key.
- [x] **Step 3: Search the maintained source and documentation** with `rg -n 'WAKATIME_API_KEY|Basic .*WAKATIME|Basic Auth' README.md worker scripts docs tests` and confirm no obsolete runtime setup remains (historical issue text may be retained only when explicitly marked as history).
- [x] **Step 4: Run `npm test`, `npm run typecheck:worker`, `npm run check`, and `npm run worker:check`; confirm all commands pass.**
- [x] **Step 5: Review `git diff --check`, inspect the final diff for token or secret exposure, and commit the documentation and complete migration.**
