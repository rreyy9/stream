import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CategoryBar } from './components/CategoryBar';
import { FilterPanel } from './components/FilterPanel';
import { StreamCard } from './components/StreamCard';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useStreams } from './hooks/useStreams';
import { activeFilterCount, applyFilters, languagesOf, SORTS, topTags, type Filters, type SortKey } from './lib/filters';
import { controlClass } from './lib/styles';
import { readUrlState, toQueryString } from './lib/urlState';
import type { GameCategory } from './types/twitch';

const DEFAULT_CATEGORIES: GameCategory[] = [
  { id: '18122', name: 'World of Warcraft' },
  { id: '509658', name: 'Just Chatting' },
];

// Initial state comes from the URL so filtered views can be shared/bookmarked.
const initial = readUrlState(window.location.search);

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function App() {
  const [category, setCategory] = useState(initial.category);
  const [filters, setFilters] = useState<Filters>(initial.filters);
  const [showFilters, setShowFilters] = useState(activeFilterCount(initial.filters) > 0);
  const [categories, setCategories] = useLocalStorage('streamlist:categories', DEFAULT_CATEGORIES);
  const [favoriteList, setFavoriteList] = useLocalStorage<string[]>('streamlist:favorites', []);
  const [autoRefresh, setAutoRefresh] = useLocalStorage('streamlist:autoRefresh', true);
  const searchRef = useRef<HTMLInputElement>(null);

  const { streams, fetchedAt, stale, error, status, hasMore, autoRefreshPaused, refresh, loadMore } = useStreams(
    category,
    autoRefresh,
  );

  const favorites = useMemo(() => new Set(favoriteList), [favoriteList]);
  const patchFilters = useCallback((patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch })), []);

  // Typing stays responsive; filtering thousands of items happens in a low-priority render.
  const deferredFilters = useDeferredValue(filters);
  const visible = useMemo(
    () => (streams ? applyFilters(streams, deferredFilters, favorites) : []),
    [streams, deferredFilters, favorites],
  );
  const languages = useMemo(() => languagesOf(streams ?? []), [streams]);
  const tags = useMemo(() => topTags(streams ?? []), [streams]);

  const now = fetchedAt ? Date.parse(fetchedAt) : 0;
  const filterCount = activeFilterCount(filters);
  const activeLabel = categories.find((c) => c.id === category)?.name ?? streams?.[0]?.game_name ?? 'Loading…';

  useEffect(() => {
    history.replaceState(null, '', toQueryString(category, filters) || window.location.pathname);
  }, [category, filters]);

  // A shared link may point at a category this browser hasn't saved yet: look up its name and save it.
  useEffect(() => {
    if (categories.some((c) => c.id === category)) return;
    const controller = new AbortController();
    fetch(`/api/categories?id=${category}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ categories: GameCategory[] }>) : null))
      .then((data) => {
        const found = data?.categories[0];
        if (found) setCategories((list) => (list.some((c) => c.id === found.id) ? list : [...list, found]));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [category, categories, setCategories]);

  // "/" focuses search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const selectCategory = (id: string) => {
    if (id === category) return;
    setCategory(id);
    patchFilters({ language: '', tag: '' });
  };

  const addCategory = (c: GameCategory) => {
    setCategories((list) => (list.some((x) => x.id === c.id) ? list : [...list, c]));
    selectCategory(c.id);
  };

  const removeCategory = (id: string) => {
    const remaining = categories.filter((c) => c.id !== id);
    if (remaining.length === 0) return;
    setCategories(remaining);
    if (id === category) selectCategory(remaining[0].id);
  };

  const toggleFavorite = useCallback(
    (login: string) => setFavoriteList((list) => (list.includes(login) ? list.filter((l) => l !== login) : [...list, login])),
    [setFavoriteList],
  );

  const onTagClick = useCallback(
    (tag: string) => {
      patchFilters({ tag });
      if (tag) setShowFilters(true);
    },
    [patchFilters],
  );

  const busy = status === 'loading' || status === 'refreshing';

  return (
    <div className="min-h-dvh bg-gray-900 text-gray-100">
      <header className="relative z-10 sm:sticky sm:top-0 border-b border-gray-700 bg-gray-800/95 shadow-lg backdrop-blur">
        <div className="mx-auto max-w-[1920px] space-y-3 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h1 className="text-2xl font-bold text-white">Live Streams</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
              <span aria-live="polite">
                {streams ? `${visible.length.toLocaleString()} of ${streams.length.toLocaleString()}` : ''}
              </span>
              {fetchedAt && (
                <span title={stale ? 'Twitch is unavailable; showing the last saved results' : undefined}>
                  {stale ? <span className="text-amber-300">Cached · </span> : null}
                  Updated {timeFormat.format(now)}
                </span>
              )}
              <label
                className="flex cursor-pointer items-center gap-1.5"
                title={autoRefreshPaused ? 'Paused while extra pages are loaded' : 'Refresh every minute while this tab is visible'}
              >
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="size-4 accent-purple-600"
                />
                Auto{autoRefreshPaused && <span className="text-gray-500">(paused)</span>}
              </label>
              <button
                type="button"
                onClick={refresh}
                disabled={busy}
                className="rounded-lg bg-gray-700 px-3 py-1.5 font-medium text-gray-200 hover:bg-gray-600 disabled:opacity-50"
              >
                {busy ? 'Loading…' : 'Refresh'}
              </button>
            </div>
          </div>

          <CategoryBar
            categories={categories}
            active={category}
            activeLabel={activeLabel}
            onSelect={selectCategory}
            onAdd={addCategory}
            onRemove={removeCategory}
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={searchRef}
              type="search"
              placeholder="Search title or channel…  ( / )"
              aria-label="Search streams"
              value={filters.search}
              onChange={(e) => patchFilters({ search: e.target.value })}
              onKeyDown={(e) => e.key === 'Escape' && patchFilters({ search: '' })}
              className={`${controlClass} flex-1 placeholder-gray-400`}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                className={`${controlClass} flex-1 whitespace-nowrap hover:bg-gray-600 ${filterCount ? 'border-purple-500' : ''}`}
              >
                Filters{filterCount > 0 && ` (${filterCount})`}
              </button>
              <select
                aria-label="Sort"
                value={filters.sort}
                onChange={(e) => patchFilters({ sort: e.target.value as SortKey })}
                className={`${controlClass} flex-1`}
              >
                {Object.entries(SORTS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {showFilters && (
            <FilterPanel
              filters={filters}
              languages={languages}
              tags={tags}
              favoriteCount={favoriteList.length}
              onChange={patchFilters}
            />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1920px] px-4 py-4">
        {error && (
          <div
            role="alert"
            className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-800 bg-red-950 p-4 text-red-200"
          >
            <span>Couldn't load streams: {error}</span>
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600"
            >
              Try again
            </button>
          </div>
        )}

        {!streams && status === 'loading' ? (
          <Grid>
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-lg bg-gray-800">
                <div className="aspect-video bg-gray-700" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-1/2 rounded bg-gray-700" />
                  <div className="h-3 w-full rounded bg-gray-700" />
                  <div className="h-3 w-3/4 rounded bg-gray-700" />
                </div>
              </div>
            ))}
          </Grid>
        ) : streams ? (
          <>
            {visible.length === 0 ? (
              <p className="py-12 text-center text-lg text-gray-400">
                {streams.length === 0 ? 'Nobody is live in this category right now' : 'No streams match your filters'}
              </p>
            ) : (
              <Grid>
                {visible.map((s) => (
                  <StreamCard
                    key={s.id}
                    stream={s}
                    now={now}
                    isFavorite={favorites.has(s.user_login)}
                    activeTag={deferredFilters.tag}
                    onToggleFavorite={toggleFavorite}
                    onTagClick={onTagClick}
                  />
                ))}
              </Grid>
            )}
            {hasMore && <LoadMore onLoadMore={loadMore} loading={status === 'loading-more'} loaded={streams.length} />}
          </>
        ) : null}
      </main>
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{children}</div>;
}

/** Infinite scroll: loads the next chunk when this comes within ~1 screen of the viewport. */
function LoadMore({ onLoadMore, loading, loaded }: { onLoadMore: () => void; loading: boolean; loaded: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && onLoadMore(), { rootMargin: '800px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [onLoadMore]);

  return (
    <div ref={ref} className="flex flex-col items-center gap-2 py-8 text-sm text-gray-400">
      <span>{loaded.toLocaleString()} streams loaded</span>
      <button
        type="button"
        onClick={onLoadMore}
        disabled={loading}
        className="rounded-lg bg-gray-700 px-4 py-2 font-medium text-gray-200 hover:bg-gray-600 disabled:opacity-50"
      >
        {loading ? 'Loading more…' : 'Load more streams'}
      </button>
    </div>
  );
}

export default App;
