# Goodreads Reading Log Design

## Goal

Add a Portuguese reading log to the portfolio using the public Goodreads profile `164676427-ikkiartz`. The section shows books currently being read, the most recently finished books, and books queued to read. Goodreads data is refreshed with the existing scheduled site build so the static site does not need a Goodreads request from each visitor.

## Existing project behavior

The portfolio is exported as a static Next.js site. The daily GitHub Actions workflow runs the same build as a normal deployment. Before Next.js builds, `npm run sync:repos` fetches the public GitHub repository catalog and writes `public/repos.json`; on failure it keeps the committed snapshot. The page reads static JSON in the browser. The Goodreads integration should follow this pattern and must not add a runtime server dependency.

The page currently numbers products as 02, Android as 03, lab as 04, GitHub activity as 05, Agora as 06, Além do código as 07, and Próximo capítulo as 08. The new section will appear after Agora as 07. Além do código and Próximo capítulo will move to 08 and 09.

## Proposed design

Add `goodreads-bookshelf-api` as a project dependency. Add a sync script that fetches the profile's `currently-reading`, `read`, and `to-read` shelves, normalizes the book fields needed by the page, and writes a deterministic `public/reading-log.json` snapshot. The script runs as part of the existing `npm run build` chain, after repository sync and before the static export. A failed fetch logs a warning and leaves the last committed snapshot in place, matching the repository catalog's resilient behavior.

Add a Reading Log section to the portfolio page after `LiveActivitySection`, with the visible title **Registro de leitura** and Japanese eyebrow `読書`. It contains three labeled groups: **Lendo atualmente**, **Últimos livros finalizados**, and **Próximos para ler**. Each book links to its Goodreads book page and shows its available cover, title, and author. The completed group is limited to the most recently finished items; currently-reading and to-read groups are bounded to keep the page concise. Missing cover art uses a text based fallback. Empty shelves show a short Portuguese empty state.

Add the section to the main navigation and active-section tracking through the existing section observation mechanism. Keep the existing chapter numbering for sections 02–06; update Além do código to 08 and Próximo capítulo to 09.

## Data contract

The snapshot contains a generated timestamp and three arrays (`currentlyReading`, `recentlyFinished`, `toRead`). Each book record contains a stable identifier, title, author, Goodreads book URL, and optional cover URL and completion date. The sync layer validates and normalizes package output before writing it. Package-specific fields do not flow directly into the UI.

## Error handling

- First-time fetch failure keeps the committed empty or seeded snapshot valid and allows the site build to finish with a warning.
- Later fetch failures retain the last known snapshot.
- Invalid or incomplete book rows are skipped rather than breaking the full sync.
- Rendering tolerates absent optional cover and date fields.

## Verification

Review the generated snapshot shape and integration with the existing static build path. The workflow's existing scheduled build remains the refresh trigger; no separate workflow or Goodreads credentials are required.

## Scope

This change is limited to Goodreads snapshot synchronization, the new portfolio section and navigation entry, chapter renumbering, and focused validation. It does not add Goodreads authentication, private shelves, reviews, ratings, or a live API endpoint.
