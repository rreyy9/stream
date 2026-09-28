import type { Stream, StreamsResponse } from '../src/types/twitch';
import { cacheHeaders, createCache, errorResponse, helix } from './_lib/twitch';

export const PAGES_PER_CHUNK = 10; // 100 streams per page -> up to 1000 streams per request

type HelixStream = Stream & { tags: string[] | null };
type Chunk = Omit<StreamsResponse, 'stale'>;

const cached = createCache<Chunk>(60_000);

/** Streamers often repeat tags with different casing ("English", "english"); keep the first of each. */
function uniqueTags(tags: string[] | null): string[] {
  const seen = new Set<string>();
  return (tags ?? []).filter((t) => {
    const key = t.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchChunk(gameId: string, startCursor: string | null): Promise<Chunk> {
  const byId = new Map<string, Stream>();
  let cursor = startCursor ?? undefined;

  // Twitch pagination is cursor-based, so pages must be fetched sequentially.
  for (let page = 0; page < PAGES_PER_CHUNK; page++) {
    const params = new URLSearchParams({ game_id: gameId, first: '100' });
    if (cursor) params.set('after', cursor);

    const body = await helix<{ data: HelixStream[]; pagination: { cursor?: string } }>('streams', params);
    for (const s of body.data) {
      byId.set(s.id, {
        id: s.id,
        user_login: s.user_login,
        user_name: s.user_name,
        title: s.title,
        viewer_count: s.viewer_count,
        started_at: s.started_at,
        language: s.language,
        thumbnail_url: s.thumbnail_url,
        game_name: s.game_name,
        is_mature: s.is_mature,
        tags: uniqueTags(s.tags),
      });
    }

    cursor = body.data.length > 0 ? body.pagination.cursor : undefined;
    if (!cursor) break;
  }

  return { streams: [...byId.values()], cursor: cursor ?? null, fetchedAt: new Date().toISOString() };
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const gameId = params.get('game_id');
  const cursor = params.get('cursor');
  if (!gameId || !/^\d+$/.test(gameId)) {
    return Response.json({ error: 'A numeric game_id is required' }, { status: 400 });
  }
  if (cursor && !/^[\w-]{1,512}$/.test(cursor)) {
    return Response.json({ error: 'Invalid cursor' }, { status: 400 });
  }

  try {
    const { data, stale } = await cached(`${gameId}:${cursor ?? ''}`, () => fetchChunk(gameId, cursor));
    const body: StreamsResponse = { ...data, stale };
    return Response.json(body, { headers: cacheHeaders(stale, 60) });
  } catch (error) {
    return errorResponse(error, 'streams');
  }
}
