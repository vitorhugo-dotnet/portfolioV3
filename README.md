# Hugo — Code Dojo

Portfolio built with Next.js 16 and React 19, using the App Router and static export.

## Run locally

```bash
npm ci
npx next dev
```

## Production

```bash
npm ci
npm run build
```

The static website is generated in `out/`. Deploy that directory to any static host.

## Features

- Japanese-inspired landscape and parallax with reduced-motion support
- Products, Android apps and filterable Java/C# studies
- Public GitHub activity tabs with snapshot fallback
- Searchable public repository catalog
- Responsive navigation

GitHub events are fetched in the browser without a token. The snapshot in `public/events.json` is from 2026-10-07 UTC. The repository catalog in `public/repos.json` is a snapshot and requires manual updates. Events are not an annual contributions calendar.

Published on GPT Sites: https://hugo-code-dojo.ikkiartz.chatgpt.site (owner-private).

GPT Sites deployment identity is managed separately and is intentionally excluded from this portable source repository.
