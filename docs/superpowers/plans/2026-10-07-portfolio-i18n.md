# PortfolioV3 Internationalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver matching statically generated Portuguese and English portfolio homepages with complete localized UI, locale-specific SEO, and Cloudflare Pages compatibility.

**Architecture:** Two App Router root layouts emit the correct `lang` for `/` and `/en`; existing Portuguese pages move under a URL-preserving `(pt)` route group. Both homepage routes render one shared client component, whose explicit locale prop selects typed TypeScript translations and formatting. MetadataRoute sitemap and robots implementations remain build-time static and preserve the existing host-specific sitemap resources.

**Tech Stack:** Next.js 16 App Router and Metadata API, TypeScript, React 19, `Intl`, Node.js built-in test runner, Biome, Cloudflare Pages static export.

**Spec:** `docs/superpowers/specs/2026-10-07-portfolio-i18n-design.md`

## Global Constraints

- Keep `output: "export"` and Cloudflare Pages compatibility.
- Do not add middleware/proxy, runtime redirects, server sessions, request cookies, server-only runtime dependencies, or i18n packages.
- Preserve existing public URLs, visual design, motion behavior, API contracts, secrets, and provider caching.
- Portuguese is the default locale at `/`; English is at `/en`.
- Language choice comes from the route, with no automatic locale detection or persistence.
- Keep API and Worker contracts locale-neutral.
- Use canonical homepage URLs `https://hugodotnet.dev/` and `https://hugodotnet.dev/en`.
- `x-default` points to `https://hugodotnet.dev/`.
- Do not fabricate `lastModified`, priority, or change frequency.
- Do not change how often the UI fetches data or how provider state is computed.
- Do not modify secrets or change environment variables unnecessarily.
- Run `npm run typecheck`, `npm run ci`, `npm test`, and `npm run build`.

## Review Focus

- English names and browser history must not lose a section hash when switching locale; test `/en#atividade` to `/#atividade` and back.
- A provider's missing, stale, or error state must be translated without changing its locale-neutral payload; assert presentation mapping for each state while keeping existing Worker contract tests green.
- GitHub event payload fields may be absent or have unknown event types; test fallback labels and ensure external titles/repository names remain verbatim.
- Static export route-group moves must preserve `/hub` and both privacy URLs while emitting only the intended `<html lang>` per root; assert generated route files and document language.
- Sitemap generation must not duplicate routes or lose host-specific Website entries when the old sitemap index path is moved; test both the MetadataRoute entries and retained sitemap child resources.

---

### Task 1: Type-safe translation and locale formatting core

**Files:**
- Create: `i18n/config.ts`
- Create: `i18n/dictionaries/pt-BR.ts`
- Create: `i18n/dictionaries/en.ts`
- Create: `i18n/translate.ts`
- Test: `tests/i18n.test.ts`

**Interfaces:**
- Produces: `Locale = "pt-BR" | "en"`, `locales`, `defaultLocale`, `DictionaryKey`, `translate(locale: Locale, key: DictionaryKey, values?: Record<string, string | number>): string`, `translatePlural(locale: Locale, oneKey: DictionaryKey, otherKey: DictionaryKey, count: number, values?: Record<string, string | number>): string`, `formatDate(locale, value, options?)`, `formatNumber(locale, value, options?)`, `formatDuration(locale, minutes)`, and `formatRelativeTime(locale, value, now?)`.
- Dictionary values are flat string templates; English must satisfy `Record<keyof typeof ptBR, string>`.

- [ ] **Step 1: Write failing translation tests**

Add `dictionaries_have_the_same_keys`, `translate_interpolates_named_values`, `translate_uses_plural_rules_for_count_messages`, and `formatters_follow_each_locale` to `tests/i18n.test.ts`. Assert key equality, named replacement, singular/plural output in both locales through `translatePlural`, `pt-BR` vs `en-US` date/number conventions, and relative-time wording.

- [ ] **Step 2: Run tests and confirm the expected missing-module failure**

Run: `node --experimental-strip-types --test tests/i18n.test.ts`
Expected: FAIL because `i18n/translate.ts` and dictionaries do not exist yet.

- [ ] **Step 3: Implement the typed dictionaries and pure helpers**

Start with the core lookup, count, and duration keys used by Task 1's tests; Task 3 adds the complete shared portfolio and live-activity presentation key set. Provide natural English values for every Portuguese key. Use `Intl.PluralRules` for count variants and `Intl.DateTimeFormat`, `Intl.NumberFormat`, and `Intl.RelativeTimeFormat` for locale formatting. Keep external data and domain types out of this module.

- [ ] **Step 4: Run i18n tests**

Run: `node --experimental-strip-types --test tests/i18n.test.ts`
Expected: all four i18n tests pass.

- [ ] **Step 5: Commit the translation core**

Commit `i18n/` and `tests/i18n.test.ts` with `feat: add type-safe locale translations`.

---

### Task 2: Locale root layouts and shared static homepage routes

**Files:**
- Move: `app/page.tsx` to `app/(pt)/page.tsx`
- Move: `app/hub/page.tsx` to `app/(pt)/hub/page.tsx`
- Move: `app/sonicrelay/privacy-policy/page.tsx` to `app/(pt)/sonicrelay/privacy-policy/page.tsx`
- Move: `app/the-universe-decides/privacy-policy/page.tsx` to `app/(pt)/the-universe-decides/privacy-policy/page.tsx`
- Move: `app/layout.tsx` to `app/(pt)/layout.tsx`
- Create: `app/en/layout.tsx`
- Create: `app/en/page.tsx`
- Create: `components/portfolio-page.tsx`
- Test: `tests/site-routes.test.ts`

**Interfaces:**
- Consumes: Task 1 `Locale` and translation helpers.
- Produces: `PortfolioPage({ locale }: { locale: Locale })`; Portuguese route `/` and English route `/en`; Portuguese root layout emits `<html lang="pt-BR">`, English root layout emits `<html lang="en">`.

- [ ] **Step 1: Extend route discovery tests**

Add `discovers_locale_routes_and_keeps_existing_public_paths`; call `publishedRoutes()` against the actual app tree and assert route group names are omitted and `/`, `/en`, `/hub`, `/sonicrelay/privacy-policy`, and `/the-universe-decides/privacy-policy` are returned once each.

- [ ] **Step 2: Run route test and confirm failure**

Run: `node --experimental-strip-types --test tests/site-routes.test.ts`
Expected: FAIL because the current app tree has no `/en` route.

- [ ] **Step 3: Move routes and add localized root layouts**

Move the current homepage, Hub, and legal pages under `(pt)` without changing their visible URL paths, and update their relative imports for the additional directory depth. Put the existing Portuguese root layout at `(pt)/layout.tsx`; add `app/en/layout.tsx` with the same global stylesheet, English defaults, and `<html lang="en">`. Create `app/en/page.tsx` and the shared `PortfolioPage` boundary. Keep metadata routes in `app/`.

- [ ] **Step 4: Run route and type checks**

Run: `node --experimental-strip-types --test tests/site-routes.test.ts && npm run typecheck`
Expected: route test passes and TypeScript reports no route/import errors.

- [ ] **Step 5: Commit localized routes**

Commit the route moves, root layouts, shared page boundary, and route test with `feat: add static locale homepage routes`.

---

### Task 3: Localize the shared portfolio and live activity UI

**Files:**
- Modify: `components/portfolio-page.tsx`
- Modify: `components/live-activity.tsx`
- Create: `components/language-switcher.tsx`
- Create: `i18n/routing.ts`
- Create: `lib/github-event-presentation.ts`
- Modify: `app/style.css`
- Modify: `tests/i18n.test.ts`

**Interfaces:**
- Consumes: Task 1 dictionary key/helper/formatter interfaces and Task 2 `PortfolioPage({ locale })` route contract.
- Produces: all shared portfolio and live-activity display text comes from the selected locale; `languageHref(locale: Locale, hash = ""): string` returns the counterpart route plus the supplied hash; `describeGitHubEvent(locale, event)` localizes event labels while preserving titles and repository identifiers; external API DTOs and polling behavior are unchanged.

- [ ] **Step 1: Add failing integration-level locale presentation tests**

Extend `tests/i18n.test.ts` with `english_dictionary_covers_portfolio_and_live_activity_copy`, `live_activity_states_have_locale_copy`, `github_event_fallbacks_keep_external_titles_verbatim`, and `language_target_preserves_hash`. Assert required main section/navigation/loading/error/fallback keys exist in English, each live-activity state has copy in both locales, dynamic interpolation preserves supplied repository/provider/media titles, unknown GitHub event labels remain safe, and `languageHref("en", "#atividade")` yields `/#atividade` (with the reverse mapping yielding `/en#atividade`).

- [ ] **Step 2: Run tests to confirm missing coverage**

Run: `node --experimental-strip-types --test tests/i18n.test.ts`
Expected: FAIL until all required dictionary keys and interpolation cases are present.

- [ ] **Step 3: Translate the portfolio and add the language switcher**

Replace user-facing Portuguese literals in the portfolio component with `translate(locale, key, values)`, including hero, projects, Android, studies, filters, repository browser, GitHub timeline and events, about, contact, footer, labels, tooltips, and accessible image/control labels. Implement localized GitHub event descriptions without translating payload titles or repository identifiers. Add `🇧🇷 PT | 🇺🇸 EN` links using Next `Link`, visible active state, accessible labels/current state, keyboard support, mobile styling, and click-time hash preservation through `languageHref` and the router navigation handler.

- [ ] **Step 4: Localize live activity presentation**

Pass locale into `LiveActivitySection` and its status-card presentation. Translate WakaTime, Spotify, Simkl, and Steam headings/categories/statuses, loading/empty/error/stale/update labels; keep brand names, titles, DTO values, API URLs, provider state logic, and polling unchanged. Use locale formatters for dates, relative times, counts, and durations.

- [ ] **Step 5: Run focused tests, lint, and typecheck**

Run: `node --experimental-strip-types --test tests/i18n.test.ts && npm run typecheck && npx biome ci components/portfolio-page.tsx components/live-activity.tsx components/language-switcher.tsx i18n tests/i18n.test.ts`
Expected: all focused tests pass, typecheck exits 0, and Biome reports no errors.

- [ ] **Step 6: Commit localized UI**

Commit shared portfolio, live activity, language switcher, styles, and tests with `feat: localize portfolio and activity UI`.

---

### Task 4: Localized metadata, MetadataRoute sitemap, and robots

**Files:**
- Modify: `lib/site-config.ts`
- Modify: `app/(pt)/layout.tsx`
- Modify: `app/(pt)/page.tsx`
- Modify: `app/en/layout.tsx`
- Modify: `app/en/page.tsx`
- Create: `app/sitemap.ts`
- Modify: `app/robots.ts`
- Move: `app/sitemap.xml/route.ts` to `app/sitemap-index.xml/route.ts`
- Modify: `lib/sitemap-data.ts`
- Modify: `tests/site-urls.test.ts`
- Create: `tests/metadata.test.ts`

**Interfaces:**
- Consumes: Task 2 static routes and Task 1 locale identifiers.
- Produces: `localizedHomepageMetadata(locale: Locale): Metadata`; `app/sitemap.ts` returns `MetadataRoute.Sitemap` for all indexable routes at `https://hugodotnet.dev` and reciprocal homepage language alternates.

- [ ] **Step 1: Add failing metadata and sitemap tests**

Add `localized_homepage_metadata_has_self_canonical_and_reciprocal_hreflang`, `sitemap_includes_both_locales_once_with_x_default`, and `robots_allows_public_routes_and_references_primary_sitemap`. Assert exact canonical URLs, titles/descriptions, `pt_BR`/`en_US`, all three alternate values, distinct route entries, no fabricated `lastModified`, and sitemap URL.

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --experimental-strip-types --test tests/metadata.test.ts tests/site-urls.test.ts`
Expected: FAIL because localized metadata and MetadataRoute sitemap exports are not implemented.

- [ ] **Step 3: Implement homepage metadata and official sitemap route**

Add self-canonical, Open Graph locale, reciprocal `pt-BR`/`en`/`x-default` alternates, localized title/description, and index/follow metadata to both homepage routes. Implement `app/sitemap.ts` with `MetadataRoute.Sitemap`, deriving the existing indexable route list and keeping the two homepage locale URLs unique. Move the current sitemap index to `/sitemap-index.xml`, update any sitemap data it depends on, and retain `/sites/sitemap/<host>.xml` output for host-specific repository Website coverage.

- [ ] **Step 4: Implement static robots metadata and update sitemap tests**

Keep `MetadataRoute.Robots`, allow `/`, and set sitemap to `https://hugodotnet.dev/sitemap.xml`. Extend sitemap tests to confirm no duplicate URLs and that existing host-grouped Website URLs remain represented in the retained sitemap resources.

- [ ] **Step 5: Run SEO-focused tests and typecheck**

Run: `node --experimental-strip-types --test tests/metadata.test.ts tests/site-urls.test.ts tests/site-routes.test.ts && npm run typecheck`
Expected: focused tests pass and TypeScript reports no metadata route errors.

- [ ] **Step 6: Commit localized SEO routes**

Commit the metadata helpers, sitemap/robots routes, sitemap tests, and moved sitemap index with `feat: add localized static SEO metadata`.

---

### Task 5: Document i18n, verify export/deployment, and deliver

**Files:**
- Modify: `README.md`
- Modify: `.github/workflows/cloudflare-pages.yml`
- Create: `scripts/verify-static-export.ts`
- Modify: `tests/metadata.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4 locale routes, metadata, and static sitemap/robots outputs.
- Produces: documented language extension path and CI checks for `/`, `/en`, existing documents, `/sitemap.xml`, `/sitemap-index.xml`, and `/robots.txt`.

- [ ] **Step 1: Add production-output validation assertions**

Add `export_contains_localized_homepages_and_seo_artifacts` in `tests/metadata.test.ts`, importing `verifyStaticExport(outputDir)` from `scripts/verify-static-export.ts`. Build a temporary fixture output directory and assert the verifier accepts correct localized HTML/sitemap/robots content and rejects a wrong `lang`, duplicate canonical, missing alternate, or `noindex` directive. The initial import must fail before the verifier exists.

- [ ] **Step 2: Run the artifact test and confirm it fails on absent fixture behavior**

Run: `node --experimental-strip-types --test tests/metadata.test.ts`
Expected: FAIL because `scripts/verify-static-export.ts` does not exist.

- [ ] **Step 3: Update README and Cloudflare Pages checks**

Document languages, default and route structure, dictionaries/type checks, lookup/interpolation/pluralization, adding keys/locales, localized metadata, sitemap/robots generation, route-based switch behavior, and static export constraints. Explain the `hugodotnet.dev` canonical choice while retaining existing dual-domain sitemap operations. Update workflow route verification to require both homepages, existing public documents, the official sitemap, retained sitemap index/child routes, robots, and static assets. Implement `verifyStaticExport(outputDir: string): Promise<void>` in `scripts/verify-static-export.ts` and invoke it against `out/` from the workflow after build; use Node's built-in assert and filesystem modules only.

- [ ] **Step 4: Run required project validation**

Run: `npm run typecheck && npm run ci && npm test && npm run build`
Expected: all commands exit 0. Build output includes both localized HTML routes, all existing public routes, `out/sitemap.xml`, retained sitemap resources, and `out/robots.txt`.

- [ ] **Step 5: Inspect generated HTML and static routes**

Run `node --experimental-strip-types scripts/verify-static-export.ts out` against `out/`; assert exact `lang`, canonical/hreflang/x-default pairs, localized titles/descriptions/OG locale, a single canonical per homepage, no `noindex`, unique required sitemap URLs, robots sitemap URL, and existing route files.
Expected: every assertion passes; no SSR-only route behavior or runtime dependency is introduced.

- [ ] **Step 6: Review the complete diff and commit implementation**

Run `git diff --check`, inspect `git diff --stat` and the full diff, then commit all implementation files with a descriptive conventional commit. Keep the approved spec and plan documents in the final implementation history.

- [ ] **Step 7: Push to main without force**

Fetch `origin`, inspect `origin/main` and merge-base before integrating. If main has unrelated new work, rebase/merge without rewriting remote history. Push the completed implementation to `origin main` normally and report the resulting commit SHA and validation output.
