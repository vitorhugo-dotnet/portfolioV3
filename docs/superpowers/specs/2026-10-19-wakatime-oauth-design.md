# WakaTime OAuth Integration Design

## Goal

Migrate the portfolio activity Worker’s WakaTime API reads from API-key Basic authentication to OAuth 2.0 bearer authentication, following issue #3 in `vitorhugo-dotnet/wakatime-mcp-cloudflare-worker`. The portfolio already integrates WakaTime for live coding activity; this change updates its authentication and credential lifecycle.

This is a single-user integration. The public live-activity response, its endpoint authentication, and the other activity providers remain unchanged. The OAuth client secret and access/refresh tokens must stay server-side and must not appear in URLs, client responses, or logs. OAuth's public client ID appears in the authorization URL, and its one-time authorization code appears in the provider callback URL; the setup script validates and exchanges the code locally without logging either URL.

## Design

Register a WakaTime OAuth application with the `read_summaries` and `read_heartbeats` scopes, which are both needed by the existing summary and heartbeat reads. A local setup script will guide the account owner through authorization-code authorization and exchange the returned code for tokens. It will print only the initial refresh token and instructions for setting the Worker secrets; client credentials and access tokens will not be printed.

The Worker will use `WAKATIME_CLIENT_ID` and `WAKATIME_CLIENT_SECRET` as secrets and an initial `WAKATIME_REFRESH_TOKEN` secret to bootstrap storage. A WakaTime-specific SQLite-backed Durable Object will persist the refresh token and access-token expiry, following the existing Simkl token-store pattern. On a read, the token helper will return a still-valid access token or exchange the stored refresh token at WakaTime’s OAuth token endpoint. It will persist rotated refresh tokens and the new expiry before returning the access token. Refresh operations for the single account will be serialized by the Durable Object so concurrent activity reads cannot reuse a rotated refresh token.

All WakaTime API reads, including heartbeat and summary requests used by the portfolio, will use `Authorization: Bearer <access_token>`. If an API read returns 401/403, the provider will force one refresh and retry once. Missing OAuth configuration reports the provider as unconfigured. Token endpoint failures, invalid responses, and a rejected retry report it unavailable without exposing token values. Existing response normalization and public field filtering remain unchanged.

The credential monitor will probe WakaTime through the same token helper and an authenticated `users/current` request. A successful refresh followed by a valid profile response is valid; rejected grants or unauthorized API responses are invalid; network, rate-limit, server, and malformed-response failures are transient. Logs and monitor notifications will contain only provider names and sanitized classifications.

Wrangler will bind the new WakaTime token-store Durable Object in preview and production, with the required migration. README setup instructions will cover application registration, local authorization, secrets in each environment, and removal of the obsolete `WAKATIME_API_KEY` requirement. Existing Simkl storage and credentials remain independent.

## Verification

Automated tests will cover bearer-authenticated live reads, initial bootstrap, refresh of expired access tokens, refresh-token rotation persistence, concurrent refresh serialization, one retry after 401/403, invalid-grant classification, transient failures, unconfigured credentials, and token redaction. Worker type checking and Wrangler preview/production dry-run validation will verify the binding and deployment configuration. Existing live activity and credential-monitor tests will be updated to the OAuth setup.

## Explicit exclusions

- Multi-user OAuth account management.
- Changes to authentication for the portfolio activity endpoint or any MCP endpoint.
- Storing WakaTime tokens in browser code, URLs, repository files, or logs.
- Changes to the existing WakaTime data model, UI, or other providers.
- Claims about an independently confirmed API-key deadline; the issue describes the earlier deadline email as corrected.
