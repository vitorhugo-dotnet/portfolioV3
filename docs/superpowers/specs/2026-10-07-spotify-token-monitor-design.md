# Spotify Refresh Token Monitor Design

## Goal

Warn the portfolio owner before the Spotify refresh token reaches its expected 180-day lifetime and detect invalid credentials for every live-activity provider through a scheduled Cloudflare Worker check.

## Context and constraints

- The existing Cloudflare Worker owns WakaTime, Spotify, Simkl, and Steam credentials for the public activity endpoint.
- The public activity endpoint must remain unchanged and must never expose credentials, webhook URLs, or monitor state.
- Monitoring runs once daily in production. Preview must not send duplicate Discord alerts.
- `SPOTIFY_AUTHORIZED_AT` is a non-secret UTC timestamp for the current authorization.
- `DISCORD_WEBHOOK_URL` and Spotify credentials remain Worker secrets.
- KV stores only deduplication state, never credentials or webhook URLs.

## Design

Add a daily `scheduled` handler to the existing Worker. It probes each configured provider's authenticated API without collecting or publishing activity. The Spotify token refresh operation becomes a shared, independently testable function used by both monitoring and the existing Spotify provider.

Use the provider's existing authentication material for these probes: WakaTime `GET /api/v1/users/current`; Spotify's refresh-token exchange; Simkl `POST /sync/activities`; and Steam `ISteamUser/GetPlayerSummaries` for the configured Steam ID. Classify WakaTime, Simkl, and Steam HTTP 401/403 as invalid credentials. Spotify `invalid_grant` indicates an invalid/revoked refresh token; `invalid_client` or HTTP 401 indicates invalid client credentials. HTTP timeouts, network failures, rate limits, server errors, malformed responses, and other ambiguous failures are transient. The monitor logs only a non-secret classification and sends no invalid-credential alert for a transient result.

For each configured provider, send a provider-specific invalid-credential alert when its probe indicates invalid credentials. For Spotify, compare the current UTC time with `SPOTIFY_AUTHORIZED_AT`: at 173 through 179 elapsed days, notify `⚠️ Spotify token expira em aproximadamente 7 dias`; at 180 days or later, notify `🚨 Spotify token deve estar expirado`. An `invalid_grant` response sends a Spotify reauthorization alert immediately regardless of token age. These date-based alerts are advisory; successful refresh confirms the token works at check time, while the configured timestamp remains the expected-lifetime reference.

Use one Cloudflare KV namespace binding named `ACTIVITY_MONITOR_STATE` in production. Store only provider names, alert-state identifiers, and the Spotify authorization timestamp. Deduplicate invalid-credential alerts per provider until a later successful probe clears that provider's invalid state. Keep Spotify age alerts deduplicated for the current `SPOTIFY_AUTHORIZED_AT`; a changed timestamp starts a new age-monitoring cycle. Alert state is persisted only after Discord accepts the webhook request, allowing retry after delivery failures.

The production Worker gets the daily cron trigger and monitor enablement. Preview does not run the monitor. If monitor enablement, Discord webhook, or KV binding is absent, the scheduled handler exits without provider requests. If `SPOTIFY_AUTHORIZED_AT` is absent or invalid, the Worker still validates provider credentials but skips only Spotify age alerts. If the Discord webhook fails, do not persist that alert as delivered. If KV is unavailable, log a sanitized error and do not include any secret values.

## Configuration

- Worker secrets: `DISCORD_WEBHOOK_URL` (production only; preview optional only if intentionally testing notifications).
- Worker variable: `SPOTIFY_AUTHORIZED_AT` (ISO 8601 UTC timestamp, production only).
- Worker bindings: `ACTIVITY_MONITOR_STATE` to a dedicated KV namespace.
- Worker variable: `ACTIVITY_MONITOR_ENABLED`, enabled only for production.
- Worker cron: daily at 06:00 UTC, aligned with the repository's existing scheduled workflow.
- Existing provider credentials configure which probes run: `WAKATIME_API_KEY`; Spotify client ID, client secret, and refresh token; Simkl client ID and access token; Steam API key and 17-digit Steam ID.

README instructions must document namespace creation/binding, setting the authorization timestamp, and provisioning secrets without placing secret values in source or command arguments.

## Validation

Tests cover each provider's invalid-auth signal, Spotify warning and 180-day windows, Spotify invalid-grant alerting, per-provider deduplication and recovery, transient failures producing no false invalid-credential or expiration alert, missing configuration, webhook failures, and storage behavior. Worker dry-runs validate both preview and production configuration; the complete project test suite, Biome CI, typechecks, and static build must pass.

## Out of scope

- OAuth login or automatic reauthorization.
- Storing or rotating Spotify credentials automatically.
- Exposing monitor state through HTTP.
- Monitoring preview credentials by default.
