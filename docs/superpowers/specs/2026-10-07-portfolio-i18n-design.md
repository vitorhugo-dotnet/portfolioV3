# PortfolioV3 internationalization design

## Goal and constraints

Add a complete English version of the portfolio at `/en` while keeping Brazilian Portuguese at `/`. The two homepages must contain the same portfolio, use the same client behavior and integrations, and ship as static HTML on Cloudflare Pages. Existing public URLs, visual design, motion behavior, API contracts, secrets, and provider caching must remain intact.

The production SEO identity requested for these localized pages is `https://hugodotnet.dev`. Portuguese is the default locale; language choice comes from the route, with no automatic locale detection or persistence.

## Routing and document layout

Use two App Router root layouts because a shared root layout cannot provide a route-specific `<html lang>` value for `/` and `/en` without request-time path inspection. Put the Portuguese routes in an `(pt)` route group with a root layout that emits `lang="pt-BR"`; keep their public URLs unchanged. Put the English homepage in `app/en` with its own root layout emitting `lang="en"`. Each root layout imports the existing global stylesheet and supplies locale-appropriate default metadata. Sitemap and robots metadata routes stay outside the page route groups.

Both homepage route files render one shared `PortfolioPage` client component with an explicit locale prop. Its existing state, animations, anchors, GitHub requests, and activity integrations remain shared. The locale prop selects presentation text and formatting only; it does not affect provider requests or payloads. Existing section IDs remain identical in both locales.

A `LanguageSwitcher` in the shared header uses Next.js `Link`, marks the current route with `aria-current`, provides accessible language names, and links between `/` and `/en`. Include the current hash on user activation where available. It must remain keyboard-operable and fit the existing responsive header without changing scroll or motion behavior.

## Translation data and formatting

Store the Portuguese source dictionary and English dictionary in TypeScript modules under `i18n/dictionaries/`. Derive the `TranslationKey` union from the Portuguese dictionary and require the English dictionary to satisfy the same key set. A small pure lookup helper performs key lookup and named interpolation. Add an `Intl.PluralRules`-based helper for count-sensitive text and locale utilities for dates, numbers, durations, and relative timestamps; use `pt-BR` and `en-US` respectively.

Pass the locale into `LiveActivitySection` and localize only display labels, loading/error/empty states, status descriptions, and formatted timestamps. GitHub event types, provider state values, repository names, technologies, game/media/book titles, URLs, and other external identifiers remain untouched. Keep API and Worker contracts locale-neutral.

Extract every user-facing string rendered by the shared portfolio and live-activity UI, including labels, descriptions, accessibility text, filters, fallback messages, dynamic GitHub event descriptions, and status text. Do not change how often the UI fetches data or how provider state is computed.

## Metadata and indexing

Create locale-aware homepage metadata with distinct titles, descriptions, Open Graph titles/descriptions, and `og:locale` (`pt_BR` and `en_US`). Each homepage has a self-referencing canonical URL: `https://hugodotnet.dev/` or `https://hugodotnet.dev/en`. Both include reciprocal `pt-BR` and `en` alternates and `x-default` pointing to Portuguese. The generated documents carry the correct `lang` attribute and remain indexable.

This is an intentional change from the current shared-artifact SEO behavior, which avoids canonicals because both `hugojava.dev` and `hugodotnet.dev` serve the artifact. The localized homepage canonical identity will now be `hugodotnet.dev`, as specified. Preserve the existing dual-domain sitemap artifacts and GitHub Website sitemap coverage as secondary sitemap resources.

Implement `app/sitemap.ts` using `MetadataRoute.Sitemap`. It emits one entry per existing indexable route on `hugodotnet.dev`, includes both homepage locale URLs, and attaches `alternates.languages` with reciprocal `pt-BR`, `en`, and `x-default` references to both homepage entries. Do not fabricate `lastModified`, priority, or change frequency. Move the existing sitemap index to a distinct stable path if needed to preserve its host-specific child sitemap discovery without conflicting with the required `/sitemap.xml` metadata route. Keep existing `/sites/sitemap/[file]` output and robots access.

Implement or retain `app/robots.ts` through `MetadataRoute.Robots`, allowing public paths and referencing `https://hugodotnet.dev/sitemap.xml`. Do not block assets or the English route.

## Static export and deployment

Keep `output: "export"`, do not add middleware/proxy, runtime redirects, server sessions, request cookies, server-only runtime dependencies, or i18n packages. Both homepage variants, sitemap, and robots must exist in the built `out/` artifact. Update Cloudflare Pages route verification to check the English export and required SEO artifacts. Keep the existing Worker and environment variables unchanged.

## Tests and documentation

Add automated tests for identical dictionary keys, typed lookup/interpolation/plural behavior, locale formatting, route discovery, locale metadata and reciprocal alternates, sitemap languages and x-default, robots sitemap URL, and the generated static HTML's route and `lang` output. Extend existing route/sitemap tests rather than weakening their host and route coverage. Existing integration tests continue to protect locale-neutral provider contracts.

Update README with the supported locales, route/default behavior, dictionary and type-safe lookup structure, steps for adding keys/languages, metadata and sitemap behavior, route-based language switching, and static-export constraints. Preserve the existing Cloudflare, integration, and dual-domain operational documentation; explain the intentional canonical SEO change.

## Validation and delivery

Run `npm run typecheck`, `npm run ci`, `npm test`, and `npm run build`. Inspect `out/index.html`, the English HTML, `out/sitemap.xml`, `out/robots.txt`, and retained host sitemap files for locale attributes, metadata, alternates, indexability, and duplicate/conflicting tags. Verify the Cloudflare Pages workflow accepts the static artifact. Review the complete diff, commit implementation changes, and push them to `main` without force-pushing or overwriting unrelated work.
