import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameCategory, StreamsResponse } from '../src/types/twitch';

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>;

const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();
let helixHandler: Handler;
let tokenCount = 0;

function helixStream(n: number, extra: Record<string, unknown> = {}) {
  return {
    id: `s${n}`,
    user_id: `u${n}`,
    user_login: `user${n}`,
    user_name: `User${n}`,
    game_id: '1',
    game_name: 'Game',
    type: 'live',
    title: `Title ${n}`,
    viewer_count: n,
    started_at: '2026-01-01T00:00:00Z',
    language: 'en',
    thumbnail_url: 'https://example.test/{width}x{height}.jpg',
    tag_ids: [],
    tags: null,
    is_mature: false,
    ...extra,
  };
}

const helixCalls = () =>
  fetchMock.mock.calls.map(([u]) => new URL(String(u))).filter((u) => u.hostname === 'api.twitch.tv');

// Module-level caches (token, results) must start empty for each test.
async function loadApi() {
  vi.resetModules();
  const streams = await import('../api/streams');
  const categories = await import('../api/categories');
  return { streams, categories };
}

const json = <T = StreamsResponse>(res: Response) => res.json() as Promise<T>;

const get = (handler: (r: Request) => Promise<Response>, path: string) => handler(new Request(`http://localhost${path}`));

beforeEach(() => {
  process.env.TWITCH_CLIENT_ID = 'client-id';
  process.env.TWITCH_CLIENT_SECRET = 'client-secret';
  tokenCount = 0;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === 'id.twitch.tv') {
      tokenCount++;
      return Response.json({ access_token: `token-${tokenCount}`, expires_in: 3600 });
    }
    return helixHandler(url, init);
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /api/streams', () => {
  it('rejects a missing or non-numeric game_id and a malformed cursor', async () => {
    const { streams } = await loadApi();
    expect((await get(streams.GET, '/api/streams')).status).toBe(400);
    expect((await get(streams.GET, '/api/streams?game_id=abc')).status).toBe(400);
    expect((await get(streams.GET, '/api/streams?game_id=1&cursor=a%20b')).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('walks up to 10 pages, trims fields, de-duplicates and returns the next cursor', async () => {
    helixHandler = (url) => {
      const page = Number(url.searchParams.get('after') ?? 0);
      // Overlap one stream between consecutive pages, as happens when rankings shift.
      const data = Array.from({ length: 100 }, (_, i) => helixStream(page * 99 + i));
      return Response.json({ data, pagination: { cursor: String(page + 1) } });
    };
    const { streams } = await loadApi();

    const res = await get(streams.GET, '/api/streams?game_id=18122');
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(helixCalls()).toHaveLength(10);
    expect(helixCalls()[0].searchParams.get('game_id')).toBe('18122');
    expect(body.streams).toHaveLength(10 * 99 + 1);
    expect(body.cursor).toBe('10');
    expect(body.stale).toBe(false);
    expect(Object.keys(body.streams[0]).sort()).toEqual(
      ['game_name', 'id', 'is_mature', 'language', 'started_at', 'tags', 'thumbnail_url', 'title', 'user_login', 'user_name', 'viewer_count'].sort(),
    );
    expect(body.streams[0].tags).toEqual([]);
    expect(res.headers.get('CDN-Cache-Control')).toContain('max-age=60');
    expect(res.headers.get('Cache-Control')).toContain('max-age=0');
  });

  it('stops at the last page and forwards the cursor to Twitch', async () => {
    helixHandler = () => Response.json({ data: [helixStream(1)], pagination: {} });
    const { streams } = await loadApi();

    const body = await json(await get(streams.GET, '/api/streams?game_id=1&cursor=abc'));

    expect(helixCalls()).toHaveLength(1);
    expect(helixCalls()[0].searchParams.get('after')).toBe('abc');
    expect(body.cursor).toBeNull();
  });

  it('removes case-insensitive duplicate tags', async () => {
    helixHandler = () =>
      Response.json({ data: [helixStream(1, { tags: ['English', 'english', 'FPS', 'English'] })], pagination: {} });
    const { streams } = await loadApi();

    const body = await json(await get(streams.GET, '/api/streams?game_id=1'));

    expect(body.streams[0].tags).toEqual(['English', 'FPS']);
  });

  it('caches results and reuses the app token', async () => {
    helixHandler = () => Response.json({ data: [helixStream(1)], pagination: {} });
    const { streams } = await loadApi();

    await get(streams.GET, '/api/streams?game_id=1');
    await get(streams.GET, '/api/streams?game_id=1');
    await get(streams.GET, '/api/streams?game_id=2');

    expect(helixCalls()).toHaveLength(2);
    expect(tokenCount).toBe(1);
  });

  it('gets a new token and retries once on 401', async () => {
    helixHandler = (_url, init) => {
      const auth = new Headers(init?.headers).get('Authorization');
      return auth === 'Bearer token-1'
        ? new Response('expired', { status: 401 })
        : Response.json({ data: [helixStream(1)], pagination: {} });
    };
    const { streams } = await loadApi();

    const res = await get(streams.GET, '/api/streams?game_id=1');

    expect(res.status).toBe(200);
    expect(tokenCount).toBe(2);
  });

  it('serves the last good result (flagged stale) when Twitch fails', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    let fail = false;
    helixHandler = () =>
      fail ? new Response('boom', { status: 500 }) : Response.json({ data: [helixStream(7)], pagination: {} });
    const { streams } = await loadApi();

    await get(streams.GET, '/api/streams?game_id=1');
    fail = true;
    vi.advanceTimersByTime(61_000);
    const res = await get(streams.GET, '/api/streams?game_id=1');
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.stale).toBe(true);
    expect(body.streams[0].id).toBe('s7');
    expect(res.headers.get('CDN-Cache-Control')).toBe('public, max-age=10');
  });

  it('backs off after a failure instead of hitting Twitch on every request', async () => {
    helixHandler = () => new Response('boom', { status: 500 });
    const { streams } = await loadApi();

    expect((await get(streams.GET, '/api/streams?game_id=1')).status).toBe(502);
    expect((await get(streams.GET, '/api/streams?game_id=1')).status).toBe(502);
    expect(helixCalls()).toHaveLength(1);
  });

  it('returns 503 with Retry-After when rate limited and nothing is cached', async () => {
    helixHandler = () =>
      new Response('slow down', {
        status: 429,
        headers: { 'Ratelimit-Reset': String(Math.floor(Date.now() / 1000) + 30) },
      });
    const { streams } = await loadApi();

    const res = await get(streams.GET, '/api/streams?game_id=1');

    expect(res.status).toBe(503);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(helixCalls()).toHaveLength(1);
  });

  it('waits and retries once when the rate limit resets almost immediately', async () => {
    let calls = 0;
    helixHandler = () =>
      ++calls === 1
        ? new Response('slow down', { status: 429, headers: { 'Ratelimit-Reset': String(Math.floor(Date.now() / 1000)) } })
        : Response.json({ data: [helixStream(1)], pagination: {} });
    const { streams } = await loadApi();

    const res = await get(streams.GET, '/api/streams?game_id=1');

    expect(res.status).toBe(200);
    expect(calls).toBe(2);
  });

  it('reports missing credentials as an error', async () => {
    delete process.env.TWITCH_CLIENT_SECRET;
    const { streams } = await loadApi();
    expect((await get(streams.GET, '/api/streams?game_id=1')).status).toBe(502);
  });
});

describe('GET /api/categories', () => {
  beforeEach(() => {
    helixHandler = () => Response.json({ data: [{ id: '1', name: 'Game', box_art_url: 'art', extra: true }] });
  });

  it('searches categories by name', async () => {
    const { categories } = await loadApi();
    const body = await json<{ categories: GameCategory[] }>(await get(categories.GET, '/api/categories?q=%20wow%20'));

    expect(helixCalls()[0].pathname).toBe('/helix/search/categories');
    expect(helixCalls()[0].searchParams.get('query')).toBe('wow');
    expect(body.categories).toEqual([{ id: '1', name: 'Game', box_art_url: 'art' }]);
  });

  it('ranks exact and prefix matches above looser matches', async () => {
    const names = ['Valiant Hearts', 'VALORANT Mobile', 'Tactical Valorant', 'VALORANT'];
    helixHandler = () => Response.json({ data: names.map((name, i) => ({ id: String(i), name, box_art_url: '' })) });
    const { categories } = await loadApi();

    const body = await json<{ categories: GameCategory[] }>(await get(categories.GET, '/api/categories?q=valorant'));

    expect(body.categories.map((c) => c.name)).toEqual(['VALORANT', 'VALORANT Mobile', 'Tactical Valorant', 'Valiant Hearts']);
  });

  it('looks up a category by id', async () => {
    const { categories } = await loadApi();
    await get(categories.GET, '/api/categories?id=18122');

    expect(helixCalls()[0].pathname).toBe('/helix/games');
    expect(helixCalls()[0].searchParams.get('id')).toBe('18122');
  });

  it('returns top categories with no query, and rejects a bad id', async () => {
    const { categories } = await loadApi();
    await get(categories.GET, '/api/categories');
    expect(helixCalls()[0].pathname).toBe('/helix/games/top');
    expect((await get(categories.GET, '/api/categories?id=x')).status).toBe(400);
  });
});
