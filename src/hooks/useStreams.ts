import { useCallback, useEffect, useRef, useState } from 'react';
import type { Stream, StreamsResponse } from '../types/twitch';

export const AUTO_REFRESH_MS = 60_000;

type Status = 'loading' | 'refreshing' | 'loading-more' | 'idle';

interface State {
  streams: Stream[] | null;
  cursor: string | null;
  fetchedAt: string | null;
  /** Client clock when the data arrived; used to schedule auto-refresh. */
  receivedAt: number;
  stale: boolean;
  chunks: number;
  error: string | null;
  status: Status;
}

const INITIAL: State = {
  streams: null,
  cursor: null,
  fetchedAt: null,
  receivedAt: 0,
  stale: false,
  chunks: 0,
  error: null,
  status: 'loading',
};

async function fetchChunk(gameId: string, cursor: string | null, signal: AbortSignal): Promise<StreamsResponse> {
  const params = new URLSearchParams({ game_id: gameId });
  if (cursor) params.set('cursor', cursor);
  const res = await fetch(`/api/streams?${params}`, { signal });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as StreamsResponse;
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Failed to load streams');

export function useStreams(gameId: string, autoRefresh: boolean) {
  const [state, setState] = useState<State>(INITIAL);
  const [reloadKey, setReloadKey] = useState(0);
  const [prevGameId, setPrevGameId] = useState(gameId);
  const moreController = useRef<AbortController | null>(null);
  const latest = useRef({ state, gameId });

  useEffect(() => {
    latest.current = { state, gameId };
  });

  // Drop the previous category's streams immediately when switching categories;
  // a refresh keeps them on screen until new data arrives.
  if (prevGameId !== gameId) {
    setPrevGameId(gameId);
    setState(INITIAL);
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchChunk(gameId, null, controller.signal)
      .then((data) =>
        setState({
          streams: data.streams,
          cursor: data.cursor,
          fetchedAt: data.fetchedAt,
          receivedAt: Date.now(),
          stale: data.stale,
          chunks: 1,
          error: null,
          status: 'idle',
        }),
      )
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState((s) => ({ ...s, receivedAt: Date.now(), error: errorMessage(err), status: 'idle' }));
      });

    return () => {
      controller.abort();
      moreController.current?.abort();
    };
  }, [gameId, reloadKey]);

  const refresh = useCallback(() => {
    moreController.current?.abort();
    setState((s) => ({ ...s, error: null, status: s.streams ? 'refreshing' : 'loading' }));
    setReloadKey((k) => k + 1);
  }, []);

  // Stable identity (reads the latest state from a ref) so an IntersectionObserver
  // using it only fires on real scroll intersections, not on every re-render.
  const loadMore = useCallback(() => {
    const { state: s, gameId: id } = latest.current;
    if (s.status !== 'idle' || !s.cursor || !s.streams) return;

    const controller = new AbortController();
    moreController.current = controller;
    setState((prev) => ({ ...prev, error: null, status: 'loading-more' }));

    fetchChunk(id, s.cursor, controller.signal)
      .then((data) =>
        setState((prev) => {
          const byId = new Map((prev.streams ?? []).map((st) => [st.id, st]));
          for (const st of data.streams) if (!byId.has(st.id)) byId.set(st.id, st);
          return {
            ...prev,
            streams: [...byId.values()],
            cursor: data.cursor,
            stale: prev.stale || data.stale,
            chunks: prev.chunks + 1,
            status: 'idle',
          };
        }),
      )
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState((prev) => ({ ...prev, error: errorMessage(err), status: 'idle' }));
      });
  }, []);

  // Auto-refresh while the tab is visible. Paused once extra chunks are loaded so
  // the list doesn't reset under someone who has scrolled deep into it.
  const autoRefreshActive = autoRefresh && state.chunks === 1;
  const { receivedAt, status } = state;

  useEffect(() => {
    if (!autoRefreshActive || status !== 'idle') return;

    const due = () => Date.now() - receivedAt >= AUTO_REFRESH_MS;
    const tick = () => {
      if (document.visibilityState === 'visible' && due()) refresh();
    };
    const timer = setTimeout(tick, Math.max(0, AUTO_REFRESH_MS - (Date.now() - receivedAt)));
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [autoRefreshActive, status, receivedAt, refresh]);

  return {
    streams: state.streams,
    fetchedAt: state.fetchedAt,
    stale: state.stale,
    error: state.error,
    status: state.status,
    hasMore: state.cursor !== null,
    autoRefreshPaused: autoRefresh && state.chunks > 1,
    refresh,
    loadMore,
  };
}
