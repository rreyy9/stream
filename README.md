# Streamlist

Browse, search, filter and sort live Twitch streams by category. Built with React 19, Vite 8 and Tailwind CSS 4, and deployed on Vercel with two small serverless functions that talk to the Twitch Helix API.

## Features

- **Any category:** search Twitch categories (or pick from the current top ones) and keep them as chips; they're saved in your browser.
- **Infinite scroll:** 1000 streams load at a time, and the next 1000 load as you near the bottom.
- **Search:** instant search by title or channel (press `/` to focus, `Esc` to clear).
- **Filters:** language, tag (or click a tag on any card), viewer-count range, hide 18+, and favorites only.
- **Favorites:** star a channel to pin it to the top of every list. Favorites are saved in your browser.
- **Auto-refresh:** every minute while the tab is visible. It pauses once you've loaded extra pages so the list doesn't jump.
- **Shareable URLs:** the category, search, filters and sort are stored in the query string.
- **Installable:** it can be installed as an app, with a manifest and icons.
- **Resilient:** if Twitch errors or rate-limits, the last good result is shown (marked "Cached").

## Getting started

Requirements: Node.js 20.19+ and a Twitch application from the [Twitch developer console](https://dev.twitch.tv/console/apps).

```bash
npm install
cp .env.example .env   # then fill in TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET
npm run dev            # http://localhost:5173
```

`npm run dev` serves both the frontend and `/api/streams`, so you don't need the Vercel CLI locally.

| Script | Description |
| --- | --- |
| `npm run dev` | Vite dev server with HMR plus the local API |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build (frontend only) |
| `npm run typecheck` | Run the TypeScript compiler |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite (`npm run test:watch` for watch mode) |

## How it works

```
Browser ──GET /api/streams?game_id=…[&cursor=…]──▶ Vercel CDN (60s, SWR 240s)
                                                     │ miss
                                                     ▼
                                              api/streams.ts ──▶ Twitch OAuth (token cached)
                                                     │        ──▶ Helix /streams × up to 10 pages
                                                     ▼
                                   trimmed JSON { streams, cursor, fetchedAt, stale }
```

| Endpoint | Description |
| --- | --- |
| `GET /api/streams?game_id=<id>[&cursor=<c>]` | Up to 1000 live streams; pass `cursor` back to get the next 1000 |
| `GET /api/categories?q=<text>` | Search categories (exact and prefix matches ranked first) |
| `GET /api/categories?id=<id>` | Look up one category by ID |
| `GET /api/categories` | Current top categories |

- **One request per chunk.** The function walks Twitch's cursor pagination on the server and returns only the fields the UI needs.
- **Caching:** the app token and results are cached in memory, and concurrent requests share a single fetch. `CDN-Cache-Control` lets Vercel's CDN serve most visitors without calling the function at all. Browsers always revalidate, so Refresh gets fresh data.
- **Resilience:** a 401 gets a new token and one retry. A 429 waits and retries if the rate limit resets within 2 seconds. Otherwise the last good result is served with `stale: true`. After a failure, the function waits 10 seconds before calling Twitch again.
- **Rendering:** cards use `content-visibility: auto` so off-screen cards cost almost nothing, and filtering runs with `useDeferredValue` so typing stays smooth.

## Project structure

```
api/streams.ts               Streams function (Web-standard GET handler)
api/categories.ts            Category search / lookup / top
api/_lib/twitch.ts           Token, Helix client, retry + stale cache (not a route)
src/App.tsx                  Layout, state, URL sync, infinite scroll
src/components/              CategoryBar (with search combobox), FilterPanel, StreamCard
src/hooks/useStreams.ts      Fetching, load more, auto-refresh
src/hooks/useLocalStorage.ts Persisted state for categories, favorites and settings
src/lib/filters.ts           Pure filter / sort logic
src/lib/urlState.ts          Query-string <-> state
src/types/twitch.ts          Shared types (client + API)
tests/                       Vitest: filters, URL state, API handlers (fetch mocked)
public/                      Icons + web app manifest
.github/workflows/ci.yml     Lint, typecheck, test and build on every push/PR
vite.config.ts               React, Tailwind, Vitest, and the local /api dev middleware
vercel.json                  Immutable caching for hashed assets
```

## Deployment (Vercel)

1. Import the repo in Vercel. The framework preset is detected as Vite.
2. Add `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` under **Settings → Environment Variables**.
3. Deploy.

## Default categories

Visitors can add any category from the UI. To change the defaults a new visitor sees, edit `DEFAULT_CATEGORIES` in `src/App.tsx` and `DEFAULT_CATEGORY_ID` in `src/lib/urlState.ts`.
