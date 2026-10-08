# Hugo — Code Dojo

Vitor Hugo's portfolio uses Next.js App Router, React, TypeScript and static export. A concise professional introduction now follows the Hero, while the personal “Além do código” section, Japanese landscape, product cards, Android mockup, laboratory filters, repository search and GitHub activity keep the original visual identity.

## Local development

Use Node.js 24 (see `.nvmrc`) and npm with the committed `package-lock.json`.

```bash
npm ci
npm run dev
```

## Languages and translations

The portfolio is available in Brazilian Portuguese (`pt-BR`) at `/` and English (`en`) at `/en`. Portuguese is the default. The URL is the source of truth for the active language; there is no automatic language detection, redirect, or saved locale. The header selector uses ordinary Next.js links and preserves a current section hash when switching between the two homepages.

The locale-specific route wrappers share `components/portfolio-page.tsx` and the same underlying activity integrations. English is rendered as static HTML at build time, just like Portuguese. The Portuguese route group supplies `lang="pt-BR"`; `/en` has its own layout with `lang="en"`.

Presentation copy lives in `i18n/dictionaries/pt-BR.ts` and `i18n/dictionaries/en.ts`. `i18n/dictionaries/pt-BR.ts` defines the translation key shape and the English dictionary must satisfy it, so mismatched keys fail TypeScript validation. Components call `translate(locale, key, values)` for plain, interpolated, and pluralized messages. Locale-aware date, number, duration and relative-time helpers are in `i18n/translate.ts`. Integration payload values and identifiers remain language-neutral; translated labels are applied at presentation time.

To add a message, add the same key to both dictionaries, then use its typed key in the component. To add another language, add its locale and dictionary, extend the route and metadata mapping, and include it in the sitemap alternates and switcher. Localized metadata is built through `localizedHomepageMetadata`: each homepage gets its own canonical, title, description, Open Graph locale and reciprocal `hreflang` links (`pt-BR`, `en`, and `x-default`). `app/sitemap.ts` creates the primary multilingual sitemap with Next.js `MetadataRoute.Sitemap`; `app/robots.ts` allows public paths and points crawlers to it. The existing host-specific sitemap set remains available through `/sitemap-index.xml`.

Static export remains enabled for Cloudflare Pages. No middleware, request-time locale detection, SSR, or i18n package is involved. Build output includes `out/index.html`, `out/en.html`, `out/sitemap.xml` and `out/robots.txt`. `scripts/verify-static-export.ts out` checks these generated files, locale metadata, sitemap alternates and public routes; CI runs the same verifier after the build.

## Quality and production

```bash
npm run format       # Format files
npm run format:check # Verify formatting
npm run lint         # Lint without rewriting
npm run check        # Formatting, linting and import organization
npm run check:write  # Apply safe fixes
npm run ci           # Read-only Biome CI checks
npm run typecheck
npm run build
```

`next.config.ts` uses the official `output: "export"` option. `next build` generates `out/`; no Next.js server, `next export`, Workers adapter or runtime secrets are needed. Direct public routes are:

| URL | Exported HTML |
| --- | --- |
| `/` | `out/index.html` |
| `/en` | `out/en.html` |
| `/hub` | `out/hub.html` |
| `/sonicrelay/privacy-policy` | `out/sonicrelay/privacy-policy.html` |
| `/the-universe-decides/privacy-policy` | `out/the-universe-decides/privacy-policy.html` |

Cloudflare Pages serves extensionless HTML routes. Other static hosts should resolve URLs to their corresponding `.html` files and serve `out/404.html` for missing pages. Do not configure a universal SPA fallback that overrides these public documents.

`npm test` runs meaningful tests with Node.js's built-in test runner, covering repository Website parsing, GitHub pagination/failure behavior, App Router route discovery and domain-safe sitemap grouping. CI runs the full suite before building. Verify desktop, tablet and mobile layouts, keyboard navigation, document links, filters/search, reduced motion and console/hydration errors when changing the UI.

Biome is the sole formatter/linter. The original repository had no ESLint, Prettier or `eslint-config-next` configuration to remove. TypeScript and the Next.js production build remain complementary validation. Biome's recommended rules cover JSX accessibility, React correctness and useful code diagnostics; Next-specific routing and static-export constraints are verified by the build and exported-route checks. The CSS `noDescendingSpecificity` rule is disabled because it flags unrelated elements in separate section scopes; reshuffling the existing responsive cascade would change its intended behavior. Reduced-motion CSS uses narrowly documented `!important` declarations to override animations reliably.

## Cloudflare deployment

`.github/workflows/cloudflare-pages.yml` runs Biome, frontend/Worker typechecks, Node tests, Worker dry-runs and the Next.js static build. Pages publishes the immutable `out/` artifact from that run. A deploy job checks out the same source to deploy the Worker, then publishes Pages; Worker failure prevents Pages publication.

| Trigger | Destination | Pages branch |
| --- | --- | --- |
| Push to `main` or daily schedule | production | `main` |
| PR opened/updated against `main` in this repository | preview | `pr-<number>` |
| Run workflow → `preview` (default) | preview | `manual-<run-id>` |
| Run workflow → `production` | production | `main`, using the selected source ref |
| PR from a fork | checks/build only | none |

Manual preview of `main` still publishes preview. Deployment is serialized per environment without canceling an active Worker/Pages publication. All previews share one preview Worker: a newer preview can change the BFF used by older preview sites. This is not an isolated backend per PR. Forks cannot receive GitHub secrets; review/import their branch into this repository to preview it. Never use `pull_request_target` to execute fork code with secrets.

Before the first deployment:

1. Select the existing Pages project and keep its production branch set to `main`. Disable duplicate automatic builds if Cloudflare Git integration is also enabled.
2. Set GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The token needs **Account → Cloudflare Pages → Edit** and **Account → Workers Scripts → Edit**, restricted to the intended account.
3. Set GitHub Actions repository variable `CLOUDFLARE_PAGES_PROJECT` to that project's name.
4. The workflow defaults to the account's `portfolio-activity-preview` and `portfolio-activity-production` Workers on `hugoalves-java.workers.dev`. If you use a different Workers subdomain or custom domain, set repository variables `ACTIVITY_API_URL_PREVIEW` and `ACTIVITY_API_URL_PRODUCTION` to the matching public HTTPS `/api/activity` URLs. These are public URLs, not secrets. CI embeds only the URL for the selected environment; production never falls back to preview.
5. Provision provider credentials separately on each Worker as described below. Missing credentials show a provider fallback instead of failing the endpoint.
6. Open/update a PR for preview, or use **Actions → Static Cloudflare Pages → Run workflow**, select the source ref, and choose `preview` or `production`. Production publishes exactly that ref's validated artifact. Deployment URLs appear in the run summary.

Actual deployments require these settings and account access. Tests and dry-runs do not establish successful authentication to Cloudflare or provider accounts.

## Live activity

Section **07 — “O que estou fazendo agora?”** follows the GitHub timeline with WakaTime, Spotify, Simkl and Steam cards. The professional introduction is section 02, the GitHub timeline remains section 06, the Goodreads reading log is 08, “Além do código” is 09 and contact is 10. The frontend polls only the public Worker endpoint while the section and tab are visible, at 60-second intervals without overlapping requests. It shows skeletons, empty/disconnected/unavailable provider states, update time and a stale-data indicator after two minutes.

`worker/src/index.ts` serves `GET /api/activity`; each adapter returns only normalized public activity. The Cache API stores that DTO for 60 seconds per Worker origin. Query strings do not create new cache entries. CORS is applied separately for each response, allowing the two portfolio domains and this project's Pages/preview domains. Localhost is allowed only for local development. CORS is not authentication; all returned activity is intentionally public.

Configure Worker secrets interactively, with no credential values in source, command arguments, logs, `NEXT_PUBLIC_*` or static files:

```bash
npx wrangler secret put WAKATIME_API_KEY --config worker/wrangler.jsonc --env preview
npx wrangler secret put SPOTIFY_CLIENT_ID --config worker/wrangler.jsonc --env preview
npx wrangler secret put SPOTIFY_CLIENT_SECRET --config worker/wrangler.jsonc --env preview
npx wrangler secret put SPOTIFY_REFRESH_TOKEN --config worker/wrangler.jsonc --env preview
npx wrangler secret put SIMKL_CLIENT_ID --config worker/wrangler.jsonc --env preview
npx wrangler secret put SIMKL_CLIENT_SECRET --config worker/wrangler.jsonc --env preview
npx wrangler secret put SIMKL_REFRESH_TOKEN --config worker/wrangler.jsonc --env preview
npx wrangler secret put STEAM_API_KEY --config worker/wrangler.jsonc --env preview
```

Repeat with `--env production`. Use Cloudflare dashboard Worker settings to set `STEAM_ID` (17-digit ID) independently on each Worker. CI uses `--keep-vars` to retain dashboard variables and passes `PAGES_PROJECT` explicitly. `EXPOSE_CODING_PROJECT` is `false` by default; only enable it in the versioned environment configuration if your project name is safe to publish. Do not publish private file paths or branches.

Production also has a daily credential monitor at 06:00 UTC. It probes each configured WakaTime, Spotify, Simkl, and Steam credential; only authentication failures alert, while timeouts, rate limits, and provider outages stay transient. Spotify authorization age alerts remain at 173/180 days. Simkl refresh-token expiry alerts fire with seven days remaining and at expiry, based on the expiry date renewed by each successful refresh; a temporary Simkl API outage does not hide those deadline alerts. The production KV namespace `ACTIVITY_MONITOR_STATE_PRODUCTION` is provisioned and bound as `ACTIVITY_MONITOR_STATE` in `worker/wrangler.jsonc`. If deploying to a different Cloudflare account, create a KV namespace with `npx wrangler kv namespace create ACTIVITY_MONITOR_STATE_PRODUCTION` and replace the production binding's `id` with the returned namespace ID. Preview has no cron and monitoring is disabled there.

Set the production `DISCORD_WEBHOOK_URL` as a Worker secret using the dashboard or interactively:

```bash
npx wrangler secret put DISCORD_WEBHOOK_URL --config worker/wrangler.jsonc --env production
```

Set the non-secret production Worker variable `SPOTIFY_AUTHORIZED_AT` to the current Spotify authorization time in ISO 8601 UTC, for example `2026-10-07T19:40:00Z`. The monitor still checks configured credentials if this timestamp is absent, but skips Spotify age notices until it is set. At day 173 it sends `⚠️ Spotify token expira em aproximadamente 7 dias`; at day 180 it sends `🚨 Spotify token deve estar expirado`. Invalid or revoked credentials for any configured provider are reported once and deduplicated in KV until that provider passes a later check.

### Bootstrap do Simkl no PowerShell

Para gerar a autorização inicial do Simkl no Windows sem gravar credenciais permanentemente no sistema, defina as variáveis apenas na sessão atual do PowerShell:

```powershell
$env:SIMKL_CLIENT_ID = "seu-client-id"
$env:SIMKL_CLIENT_SECRET = "seu-client-secret"
$env:SIMKL_REDIRECT_URI = "http://127.0.0.1:8888/callback"

node --experimental-strip-types scripts/simkl-auth.ts
```

Essas variáveis existem somente no processo atual do PowerShell e nos processos filhos. Fechar o terminal remove os valores. Evite `setx` para este fluxo, pois ele persiste as variáveis no Windows.

Para conferir as variáveis não sensíveis:

```powershell
$env:SIMKL_CLIENT_ID
$env:SIMKL_REDIRECT_URI
```

Não imprima `SIMKL_CLIENT_SECRET` no terminal. Depois de finalizar a autorização, limpe explicitamente a sessão se o terminal continuar aberto:

```powershell
$env:SIMKL_CLIENT_ID = $null
$env:SIMKL_CLIENT_SECRET = $null
$env:SIMKL_REDIRECT_URI = $null
```

Provider setup and behavior:

- **WakaTime:** [official API](https://wakatime.com/developers). API key remains server-side. Coding is active only with a heartbeat in the last five minutes; language/editor and today's minutes are normalized. Project name requires explicit opt-in.
- **Spotify:** [official API](https://developer.spotify.com/documentation/web-api). Obtain your account's refresh token out of band with `user-read-currently-playing` and `user-read-recently-played` scopes. The Worker refreshes/reuses access tokens in memory and retries a 401 once. It shows recent tracks when nothing is playing. Reprovision expired/revoked refresh credentials as needed; the website does not provide an OAuth login or persistent token storage.
- **Simkl:** [official AUTH V2 flow](https://api.simkl.org/api-reference/oauth2-authorization-code), [refresh tokens](https://api.simkl.org/api-reference/oauth2-tokens), and [API reference](https://api.simkl.org/). The Worker keeps the access and refresh token pair in the SQLite-backed `SimklTokenStore` Durable Object, refreshes before access-token expiry, and retries a rejected API request once after refreshing. The refresh token remains server-side and the Durable Object serializes refreshes so a single Simkl grant is not refreshed concurrently. Bootstrap the initial grant locally by setting `SIMKL_CLIENT_ID`, `SIMKL_CLIENT_SECRET`, and the exact registered `SIMKL_REDIRECT_URI` in your local environment, then run `node --experimental-strip-types scripts/simkl-auth.ts`. The script checks PKCE state and Simkl's issuer before exchanging the code, and prints only the refresh token for setting as a Worker secret. The adapter checks `/sync/activities` and watch history, using a rolling 30-day window. Items older than this window may not appear; activity becomes idle after 40 minutes without a new watch-history entry.
- **Steam:** [GetPlayerSummaries](https://partner.steamgames.com/doc/webapi/ISteamUser) and [GetRecentlyPlayedGames](https://partner.steamgames.com/doc/webapi/IPlayerService), through the official public `api.steampowered.com` host. Current `gameid`/`gameextrainfo` takes precedence. Otherwise a game with most playtime in the last two weeks is labeled “Jogado recentemente”; the API does not establish the last game chronologically. Private profiles/Game Details and missing history show a fallback. No SteamDB or scraping.

Run locally with an ignored `worker/.dev.vars` file containing your credentials and optional `STEAM_ID`, then `npm run worker:dev`. Set `NEXT_PUBLIC_ACTIVITY_API_URL=http://localhost:8787/api/activity` for `npm run dev`. The production build can leave the URL unset to show disconnected placeholders. The Worker uses in-memory provider snapshots, the edge Cache API, the existing monitoring KV namespace, and a SQLite-backed Durable Object for Simkl's refresh token pair.

Validation commands:

```bash
npm run ci
npm run typecheck
npm run typecheck:worker
npm test
npm run worker:check
npm run build
```

Tests use injected fetch/cache/clock fixtures, including Spotify refresh/retry, provider outages, Steam privacy, CORS, cache TTL, abort/visibility, stale data and deployment selection/failure ordering. Browser checks at 375px and 1440px verify four cards, mobile navigation, section order, fallbacks, stale labels and reduced motion without overflow or page errors. Real provider authentication and cloud deployment need provisioned credentials and are not inferred from mocks.

## Motion and accessibility

Motion for React (`motion/react`) drives viewport reveals, staggered product/technology badges, hero scale/fade/depth, independent decorative layers and a thin page-progress line. IntersectionObserver updates the active navigation section only at section boundaries. Transform and opacity animations avoid per-frame React state updates and raw scroll handlers. No GSAP or scroll-jacking is used.

The Android section uses one desktop-only sticky mockup alongside progressively revealed app resources. Tablet/mobile devices get shorter reveals and no scroll-linked parallax. The hero's movement control switches motion off. The OS `prefers-reduced-motion` setting always overrides it, including changes made while the page is open; parallax and sticky storytelling are disabled and every reveal remains visible. Server-rendered content is visible before hydration and without animation.

## Public documents

The Hub is integrated into the portfolio navigation and footer. Resource cards are configured in `components/hub-resources.ts`. Shared `ResourceShell`, `DocumentLayout` and `DocumentSection` components keep future documents consistent with the portfolio. Add a resource record and an App Router page to publish another document.

Both policies preserve their complete original text from [PortfolioV2](https://github.com/vitorhugo-dotnet/portfolioV2), including the original update dates (SonicRelay: August 18, 2026; The Universe Decides: July 16, 2026). Their English content has an explicit language attribute, semantic sections and route-specific metadata. Changing presentation must not shorten or update legal content inadvertently.

## Public GitHub data

GitHub events are fetched in the browser without a token, with `public/events.json` as the fallback. That snapshot is from 2026-10-07 UTC. `public/repos.json` is a public catalog snapshot and requires manual updates. Events are not an annual contributions calendar. No server-side feature is required for either resource.

The original GPT Sites deployment was https://hugo-code-dojo.ikkiartz.chatgpt.site (owner-private). Its deployment identity remains separate from this portable source repository.


## Favicon, sharing previews and search indexing

`public/favicon.svg` is the supplied H logo, preserved unchanged. `public/hugo-preview.png` is a 1200×630 PNG rendering of the SVG with portfolio branding; PNG works with social crawlers that do not support SVG preview images. Open Graph and Twitter metadata use this shared image on every public page, with each document's own title/description.

The static artifact serves `hugojava.dev` and `hugodotnet.dev`, with `hugodotnet.dev` as the canonical search identity. The Portuguese homepage canonical is `https://hugodotnet.dev/`; the English homepage canonical is `https://hugodotnet.dev/en`. Both include reciprocal language alternatives. Other host-specific documents retain their own metadata. The preview image is hosted at `https://hugojava.dev/hugo-preview.png` and reused by both domains. Social services may cache an earlier card until they recrawl it.

`npm run build` first runs `npm run sync:repos`, which retrieves all pages of the public GitHub repository catalog, including each repository's **About → Website** field. Successful results refresh `public/repos.json` for that build. If GitHub is unavailable, rate-limits the request or returns an incomplete catalog, the committed snapshot is retained and the build reports a warning. Snapshot entries may optionally contain `homepage` and `description` fields for offline builds. No GitHub token is required. README links are not scanned automatically.

The Hub lists websites under `hugojava.dev`, `hugodotnet.dev` and their subdomains under **Project websites**. Other public HTTP(S) websites appear in **Outros**, at the end of the Hub; unsafe schemes are rejected. The repository search continues to use the same catalog.

The sitemap files are generated during each static build:

- `/sitemap.xml`: primary multilingual sitemap for `hugodotnet.dev`, including `/`, `/en`, other public routes and reciprocal `pt-BR`, `en`, and `x-default` homepage alternates.
- `/sitemap-index.xml`: index of the generated host-specific files retained for the existing cross-domain and discovered-subdomain sitemap set.
- `/sites/sitemap/hugojava.dev.xml` and `/sites/sitemap/hugodotnet.dev.xml`: all published portfolio routes on their respective domain, plus matching Website URLs.
- `/sites/sitemap/<subdomain>.xml`: Website URLs for each matching subdomain discovered in the catalog.
- `/robots.txt`: `User-Agent: *`, `Allow: /`, with `https://hugodotnet.dev/sitemap.xml`. No crawler is blocked.

Each child sitemap contains URLs for a single host. External websites never enter these sitemaps. The host-specific sitemap index and files are hosted on `hugojava.dev`; **verify ownership of both domains (including their subdomains) in Google Search Console and submit the index there to authorize cross-site sitemap submission**. The canonical-domain sitemap is at `https://hugodotnet.dev/sitemap.xml`. Publishing a sitemap does not guarantee that a search engine indexes a URL. No arbitrary GitHub Website value can add a third-party host to the index.

New static App Router pages are discovered automatically; private directories, parallel slots and dynamic route templates are excluded because their concrete URLs cannot be inferred from file names. GitHub Actions also rebuilds daily at 03:00 America/Sao_Paulo (06:00 UTC), refreshing Website links without a source change. Everything remains static in `out/`; no request-time backend or additional dependency is required.


## WebMCP: public read-only portfolio tools

The homepage registers five [WebMCP](https://developer.chrome.com/docs/ai/webmcp/imperative-api) tools after client hydration, only when `document.modelContext.registerTool` is supported. No polyfill or JavaScript runtime dependency is added. Unsupported browsers continue to show the normal site without errors or changes to the UI.

- `portfolio_list_sections`: lists the visible portfolio sections and their links.
- `portfolio_get_about`: reads the professional introduction and personal interests.
- `portfolio_get_reading`: reads the public bookshelf entries actually rendered on the page.
- `portfolio_get_now`: reads the public live-activity UI, including loading, idle, offline and stale labels; it does not trigger provider API calls.
- `portfolio_get_section`: reads any allowlisted homepage section (products, Android, laboratory, GitHub activity, etc.).

Each execution reads the current DOM, so it uses the same language and content as the visitor's page, not a parallel copy. Tools are annotated read-only and untrusted-content, do not navigate, mutate state, or access credentials, and are unregistered via `AbortController` on unmount. Registration failures are isolated per tool. Run `npm test` for fallback, lifecycle, and data contract coverage. WebMCP availability depends on the visitor's browser and its experimental feature configuration.
