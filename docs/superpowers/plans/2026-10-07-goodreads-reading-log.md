# Goodreads Reading Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Portuguese Goodreads reading log to the static portfolio and refresh its public shelves during the existing daily site build.

**Architecture:** A sync script uses `goodreads-bookshelf-api` to fetch the public `currently-reading`, `read`, and `to-read` shelves, normalizes them into `public/reading-log.json`, and preserves the prior snapshot if Goodreads is unavailable. The portfolio renders that snapshot as section 07 after Agora; existing later sections move down by one.

**Tech Stack:** Next.js static export, React, TypeScript, Node 24, GitHub Actions scheduled build, `goodreads-bookshelf-api` 1.0.2.

**Spec:** `docs/superpowers/specs/2026-10-07-goodreads-reading-log-design.md`

## Global Constraints

- Use public Goodreads profile `164676427-ikkiartz`.
- Refresh through the existing scheduled site build; do not add runtime API calls or Goodreads credentials.
- Display the title **Registro de leitura**, eyebrow `読書`, and groups **Lendo atualmente**, **Últimos livros finalizados**, and **Próximos para ler**.
- Each displayed book links to Goodreads and shows available cover, title, and author.
- New section is 07 after Agora; Além do código and Próximo capítulo become 08 and 09.
- Keep snapshot generation resilient: warn and retain the committed snapshot on fetch failure.

## Review Focus

- Goodreads may return a malformed shelf response; normalization must produce a valid empty shelf without breaking the build.
- Goodreads may omit cover, author, or completion date; the UI must tolerate missing optional fields.
- Goodreads may return dates as strings or dates may be missing; recently finished books must sort newest first when dates are available.
- A Goodreads response can be empty; each group must render a concise Portuguese empty state.
- The sync can fail after a successful prior build; it must leave the previous JSON untouched.

---

### Task 1: Sync Goodreads shelves into a static snapshot

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `lib/reading-log.ts`
- Create: `scripts/sync-reading-log.ts`
- Create: `public/reading-log.json`
- Modify: `package.json` build and script entries

**Interfaces:**
- Produces `ReadingLogBook` with `id: string`, `title: string`, `author: string`, `url: string`, optional `coverUrl: string` and `finishedAt: string`.
- Produces `ReadingLogSnapshot` with `generatedAt: string`, `currentlyReading: ReadingLogBook[]`, `recentlyFinished: ReadingLogBook[]`, and `toRead: ReadingLogBook[]`.
- `normalizeReadingLog(shelves: { currentlyReading: unknown; read: unknown; toRead: unknown }, generatedAt: string): ReadingLogSnapshot` validates package rows, sorts `read` newest-first by completion date where available, and applies display bounds (3 currently reading, 4 recently finished, 4 to-read).
- Sync script constructs `GoodreadsShelf` from the package default export with `{ username: "164676427-ikkiartz", shelf }`, calls `fetch()` for each shelf, and writes JSON only after all three fetches and normalization succeed.

- [x] **Step 1: Add `goodreads-bookshelf-api` and sync command**

Add the dependency and an `"sync:reading-log": "node --experimental-strip-types scripts/sync-reading-log.ts"` script. Update `build` to run `sync:repos`, then `sync:reading-log`, then `next build`.

- [x] **Step 2: Define the snapshot contract and normalizer in `lib/reading-log.ts`**

Normalize package fields `title`, `author`, `bookLink`, `imageLink`, `guid`, and `readAt` into the declared types. Reject rows without a title or safe HTTPS Goodreads book URL. Keep optional values absent when invalid. Return bounded arrays, sorting completed books by valid `readAt` descending and preserving original order when dates are unavailable.

- [x] **Step 3: Add a valid initial snapshot at `public/reading-log.json`**

Create an empty snapshot using the exact four-key contract and an ISO timestamp so the first unavailable Goodreads fetch does not break the static export.

- [x] **Step 4: Implement atomic resilient shelf synchronization**

Fetch all three shelves with the package, normalize them, write formatted JSON to a temporary sibling file, then rename it to `public/reading-log.json`. Catch fetch/parse/write errors before replacement, log a warning, and leave the prior snapshot intact.

- [x] **Step 5: Review the build wiring and generated snapshot contract**

Confirm `npm run build` refreshes both public snapshots before `next build`; confirm the JSON keys and row types match `ReadingLogSnapshot`.

### Task 2: Add the Registro de leitura section and navigation

**Files:**
- Create: `components/reading-log.tsx`
- Modify: `app/page.tsx`
- Modify: `components/live-activity.tsx`
- Modify: `app/style.css`

**Interfaces:**
- `ReadingLogSection` imports the typed JSON snapshot from `public/reading-log.json` and renders section id `leitura`.
- The page mounts it immediately after `LiveActivitySection`.

- [x] **Step 1: Create `ReadingLogSection` with the approved content groups**

Render section label `07 / 読書` and title `Registro de leitura`. Render groups using the specified Portuguese labels. Book cards link through each record's Goodreads URL and include cover image when available, title and author. Render text fallback for a missing cover and a Portuguese empty state for an empty group. Add no live browser fetch.

- [x] **Step 2: Mount the section and add its main navigation entry**

Import and place `ReadingLogSection` after `<LiveActivitySection />` in `app/page.tsx`. Add `leitura` to the main navigation with the visible label `Leitura`; the existing section observer will then track its id.

- [x] **Step 3: Shift later section numbers and style book groups**

Change `components/live-activity.tsx`'s Agora label to remain `06 / AGORA`. Change Além do código to `08 / ALÉM DO CÓDIGO` and Próximo capítulo to `09 / PRÓXIMO CAPÍTULO`. Add responsive styles for three shelf groups and book cards, following existing colors, spacing, typography, and mobile breakpoints.

- [x] **Step 4: Review static export integration and section order**

Inspect the rendered page source for the order Agora (06), Registro de leitura (07), Além do código (08), and Próximo capítulo (09). Confirm the book links and optional cover fallback use only snapshot values.

