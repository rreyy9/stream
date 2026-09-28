// Shared Twitch Helix helpers. Files under api/_lib are not exposed as Vercel functions.

export class TwitchError extends Error {
  readonly status: number;
  readonly retryAfter?: number;

  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

let cachedToken: string | null = null;
let tokenExpiry = 0;

function credentials() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new TwitchError('Twitch API credentials not configured', 500);
  return { clientId, clientSecret };
}

async function getAppToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const { clientId, clientSecret } = credentials();
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) throw new TwitchError(`Twitch OAuth failed: ${res.status}`, res.status);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000 - 60_000; // refresh 1 min early
  return cachedToken;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GET a Helix endpoint. Retries once with a fresh token on 401, and once after a
 * short wait on 429 when Twitch says the rate-limit bucket resets within 2 seconds.
 */
export async function helix<T>(path: string, params: URLSearchParams, retried = false): Promise<T> {
  const { clientId } = credentials();
  const token = await getAppToken();
  const res = await fetch(`https://api.twitch.tv/helix/${path}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId },
  });

  if (res.ok) return (await res.json()) as T;

  if (res.status === 401 && !retried) {
    cachedToken = null;
    return helix(path, params, true);
  }

  if (res.status === 429) {
    const reset = Number(res.headers.get('Ratelimit-Reset')) * 1000;
    const waitMs = Number.isFinite(reset) ? Math.max(0, reset - Date.now()) : Infinity;
    if (!retried && waitMs <= 2000) {
      await sleep(waitMs);
      return helix(path, params, true);
    }
    throw new TwitchError('Twitch rate limit exceeded', 429, Math.ceil(Math.min(waitMs, 60_000) / 1000));
  }

  throw new TwitchError(`Twitch API error: ${res.status}`, res.status);
}

interface CacheEntry<T> {
  expires: number;
  promise: Promise<T>;
}

/**
 * Per-instance cache with in-flight de-duplication. If a refresh fails, the last
 * good value is served (flagged stale) instead of an error.
 */
export function createCache<T>(ttlMs: number, maxEntries = 200) {
  const fresh = new Map<string, CacheEntry<T>>();
  const lastGood = new Map<string, T>();

  return async function cached(key: string, load: () => Promise<T>): Promise<{ data: T; stale: boolean }> {
    let entry = fresh.get(key);
    if (!entry || Date.now() >= entry.expires) {
      entry = { expires: Date.now() + ttlMs, promise: load() };
      fresh.set(key, entry);
      if (fresh.size > maxEntries) fresh.delete(fresh.keys().next().value!);
    }

    try {
      const data = await entry.promise;
      lastGood.set(key, data);
      if (lastGood.size > maxEntries) lastGood.delete(lastGood.keys().next().value!);
      return { data, stale: false };
    } catch (error) {
      // Back off for a few seconds instead of retrying Twitch on every request.
      if (fresh.get(key) === entry) entry.expires = Math.min(entry.expires, Date.now() + 10_000);
      const fallback = lastGood.get(key);
      if (fallback !== undefined) return { data: fallback, stale: true };
      throw error;
    }
  };
}

export function errorResponse(error: unknown, label: string): Response {
  console.error(`${label} error:`, error);
  const status = error instanceof TwitchError && error.status === 429 ? 503 : 502;
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (error instanceof TwitchError && error.retryAfter) headers['Retry-After'] = String(error.retryAfter);
  const message = status === 503 ? 'Twitch is rate limiting requests, try again shortly' : 'Failed to reach Twitch';
  return Response.json({ error: message }, { status, headers });
}

export function cacheHeaders(stale: boolean, sMaxAge: number): Record<string, string> {
  return {
    // Browsers always revalidate (so Refresh really refreshes); the CDN-Cache-Control
    // header, which Vercel's CDN honors, lets the CDN serve one result to every visitor.
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'CDN-Cache-Control': stale
      ? 'public, max-age=10'
      : `public, max-age=${sMaxAge}, stale-while-revalidate=${sMaxAge * 4}`,
  };
}
