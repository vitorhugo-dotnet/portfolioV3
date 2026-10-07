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

There was no automated test suite or test script in this repository. CI retains a separate `test` job that explicitly reports this and automatically runs `npm test` if a test script is added later. No placeholder tests have been added. Verify desktop, tablet and mobile layouts, keyboard navigation, document links, filters/search, GitHub fallback, reduced motion and console/hydration errors when changing the UI. Check the four exported HTML files after every production build.

Biome is the sole formatter/linter. The original repository had no ESLint, Prettier or `eslint-config-next` configuration to remove. TypeScript and the Next.js production build remain complementary validation. Biome's recommended rules cover JSX accessibility, React correctness and useful code diagnostics; Next-specific routing and static-export constraints are verified by the build and exported-route checks. The CSS `noDescendingSpecificity` rule is disabled because it flags unrelated elements in separate section scopes; reshuffling the existing responsive cascade would change its intended behavior. Reduced-motion CSS uses narrowly documented `!important` declarations to override animations reliably.

## Cloudflare Pages deployment

`.github/workflows/cloudflare-pages.yml` validates pull requests and pushes to `main`:

```text
quality (Biome + TypeScript) ─┐
                             ├─ build ─ immutable out/ artifact ─ deploy
 test (suite if configured) ─┘
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
