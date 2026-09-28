import type { GameCategory } from '../src/types/twitch.js';
import { cacheHeaders, createCache, errorResponse, helix } from './_lib/twitch.js';

const cached = createCache<GameCategory[]>(5 * 60_000);

interface HelixGame {
  id: string;
  name: string;
  box_art_url: string;
}

const toCategory = (g: HelixGame): GameCategory => ({ id: g.id, name: g.name, box_art_url: g.box_art_url });

/** Twitch's search ranking is loose; put exact, then prefix, then substring matches first. */
function rank(categories: GameCategory[], query: string): GameCategory[] {
  const q = query.toLowerCase();
  const score = (name: string) => {
    const n = name.toLowerCase();
    return n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : 3;
  };
  return categories
    .map((c, i) => ({ c, i, s: score(c.name) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map(({ c }) => c);
}

/**
 * GET /api/categories?q=<text>  search categories by name
 * GET /api/categories?id=<id>   look up one category (used for shared links)
 * GET /api/categories           top categories right now
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const q = params.get('q')?.trim().slice(0, 100);
  const id = params.get('id');

  if (id !== null && !/^\d+$/.test(id)) {
    return Response.json({ error: 'id must be numeric' }, { status: 400 });
  }

  try {
    const { data, stale } = id
      ? await cached(`id:${id}`, async () => {
          const res = await helix<{ data: HelixGame[] }>('games', new URLSearchParams({ id }));
          return res.data.map(toCategory);
        })
      : q
        ? await cached(`q:${q.toLowerCase()}`, async () => {
            const res = await helix<{ data: HelixGame[] }>(
              'search/categories',
              new URLSearchParams({ query: q, first: '12' }),
            );
            return rank(res.data.map(toCategory), q);
          })
        : await cached('top', async () => {
            const res = await helix<{ data: HelixGame[] }>('games/top', new URLSearchParams({ first: '12' }));
            return res.data.map(toCategory);
          });

    return Response.json({ categories: data, stale }, { headers: cacheHeaders(stale, 300) });
  } catch (error) {
    return errorResponse(error, 'categories');
  }
}
