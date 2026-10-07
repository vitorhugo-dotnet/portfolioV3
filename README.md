# Hugo — Code Dojo

Vitor Hugo's portfolio uses Next.js App Router, React, TypeScript and static export. The Japanese landscape, product cards, Android mockup, laboratory filters, repository search and GitHub activity keep the original visual identity.

## Local development

Use Node.js 24 (see `.nvmrc`) and npm with the committed `package-lock.json`.

```bash
npm ci
npm run dev
```

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
| `/hub` | `out/hub.html` |
| `/sonicrelay/privacy-policy` | `out/sonicrelay/privacy-policy.html` |
| `/the-universe-decides/privacy-policy` | `out/the-universe-decides/privacy-policy.html` |

Cloudflare Pages serves extensionless HTML routes. Other static hosts should resolve URLs to their corresponding `.html` files and serve `out/404.html` for missing pages. Do not configure a universal SPA fallback that overrides these public documents.

`npm test` runs meaningful tests with Node.js's built-in test runner, covering repository Website parsing, GitHub pagination/failure behavior, App Router route discovery and domain-safe sitemap grouping. CI runs the full suite before building. Verify desktop, tablet and mobile layouts, keyboard navigation, document links, filters/search, reduced motion and console/hydration errors when changing the UI.

Biome is the sole formatter/linter. The original repository had no ESLint, Prettier or `eslint-config-next` configuration to remove. TypeScript and the Next.js production build remain complementary validation. Biome's recommended rules cover JSX accessibility, React correctness and useful code diagnostics; Next-specific routing and static-export constraints are verified by the build and exported-route checks. The CSS `noDescendingSpecificity` rule is disabled because it flags unrelated elements in separate section scopes; reshuffling the existing responsive cascade would change its intended behavior. Reduced-motion CSS uses narrowly documented `!important` declarations to override animations reliably.

## Cloudflare Pages deployment

`.github/workflows/cloudflare-pages.yml` validates pull requests and pushes to `main`:

```text
quality (Biome + TypeScript) ─┐
                             ├─ build ─ immutable out/ artifact ─ deploy
 test (Node.js suite) ─┘
```

The build job installs with `npm ci`, builds once, checks every required exported route and uploads `out/`. The deploy job downloads that same commit-named artifact and deploys it with the official Wrangler action. It does not check out or rebuild source. Only `main` can deploy production; pull requests only validate. Concurrency cancels superseded runs for the same branch. Actions use the maintained major versions verified against their official repositories when this workflow was added.

Before the first deployment:

1. Create or select a Cloudflare Pages project and set its production branch to `main`.
2. In GitHub **Settings → Secrets and variables → Actions**, set repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
3. Add repository variable `CLOUDFLARE_PAGES_PROJECT` with the existing project's name.
4. Use a Cloudflare API token with **Account → Cloudflare Pages → Edit**, restricted to the intended account. No zone, DNS or unrelated Workers permissions are required. Cloudflare's available Pages token scope applies at account level; it does not isolate one Pages project.
5. If the project also has Cloudflare Git integration, disable its automatic builds to avoid a second independent deployment alongside this workflow.
6. Push to `main` or run the workflow manually on `main`.

Credentials belong only in GitHub secrets. Project names and account IDs must never be hardcoded into application code. Actual Cloudflare deployment requires these repository settings; local builds do not.

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

The same static artifact serves `hugojava.dev` and `hugodotnet.dev`. There is no fixed canonical or `og:url` that replaces the address being shared with the other domain. The preview image is hosted at `https://hugojava.dev/hugo-preview.png` and reused by both domains. Actual metadata cannot vary with the request hostname in a static export; this setup preserves the requested link's identity without introducing an edge runtime. Social services may cache an earlier card until they recrawl it.

`npm run build` first runs `npm run sync:repos`, which retrieves all pages of the public GitHub repository catalog, including each repository's **About → Website** field. Successful results refresh `public/repos.json` for that build. If GitHub is unavailable, rate-limits the request or returns an incomplete catalog, the committed snapshot is retained and the build reports a warning. Snapshot entries may optionally contain `homepage` and `description` fields for offline builds. No GitHub token is required. README links are not scanned automatically.

The Hub lists websites under `hugojava.dev`, `hugodotnet.dev` and their subdomains under **Project websites**. Other public HTTP(S) websites appear in **Outros**, at the end of the Hub; unsafe schemes are rejected. The repository search continues to use the same catalog.

The sitemap is generated during each static build:

- `/sitemap.xml`: index of the generated host-specific files.
- `/sites/sitemap/hugojava.dev.xml` and `/sites/sitemap/hugodotnet.dev.xml`: all published portfolio routes on their respective domain, plus matching Website URLs.
- `/sites/sitemap/<subdomain>.xml`: Website URLs for each matching subdomain discovered in the catalog.
- `/robots.txt`: `User-Agent: *`, `Allow: /`, with the shared sitemap index URL. No crawler is blocked.

Each child sitemap contains URLs for a single host. External websites never enter these sitemaps. The shared sitemap index and files are hosted on `hugojava.dev`; **verify ownership of both domains (including their subdomains) in Google Search Console and submit the index there to authorize cross-site sitemap submission**. Publishing a sitemap does not guarantee that a search engine indexes a URL. No arbitrary GitHub Website value can add a third-party host to the index.

New static App Router pages are discovered automatically; private directories, parallel slots and dynamic route templates are excluded because their concrete URLs cannot be inferred from file names. GitHub Actions also rebuilds daily at 03:00 America/Sao_Paulo (06:00 UTC), refreshing Website links without a source change. Everything remains static in `out/`; no request-time backend or additional dependency is required.
