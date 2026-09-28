import type { Stream } from '../types/twitch';

export const SORTS = {
  'viewers-desc': 'Most viewers',
  'viewers-asc': 'Fewest viewers',
  newest: 'Recently started',
} as const;
export type SortKey = keyof typeof SORTS;

export const VIEWER_RANGES = {
  any: { label: 'Any viewers', min: 0, max: Infinity },
  'lt-10': { label: 'Under 10', min: 0, max: 9 },
  '10-100': { label: '10 – 100', min: 10, max: 100 },
  '100-1k': { label: '100 – 1K', min: 100, max: 1_000 },
  '1k-10k': { label: '1K – 10K', min: 1_000, max: 10_000 },
  '10k+': { label: '10K+', min: 10_000, max: Infinity },
} as const;
export type ViewerRange = keyof typeof VIEWER_RANGES;

export interface Filters {
  search: string;
  language: string;
  tag: string;
  viewers: ViewerRange;
  hideMature: boolean;
  favoritesOnly: boolean;
  sort: SortKey;
}

export const DEFAULT_FILTERS: Filters = {
  search: '',
  language: '',
  tag: '',
  viewers: 'any',
  hideMature: false,
  favoritesOnly: false,
  sort: 'viewers-desc',
};

/** Number of narrowing filters in effect (search and sort excluded), for the "Filters (n)" badge. */
export function activeFilterCount(f: Filters): number {
  return [f.language, f.tag, f.viewers !== 'any', f.hideMature, f.favoritesOnly].filter(Boolean).length;
}

const compareBySort: Record<SortKey, (a: Stream, b: Stream) => number> = {
  'viewers-desc': (a, b) => b.viewer_count - a.viewer_count,
  'viewers-asc': (a, b) => a.viewer_count - b.viewer_count,
  newest: (a, b) => Date.parse(b.started_at) - Date.parse(a.started_at),
};

/** Filters and sorts streams. Favorite channels are always pinned to the top. */
export function applyFilters(streams: readonly Stream[], f: Filters, favorites: ReadonlySet<string>): Stream[] {
  const q = f.search.trim().toLowerCase();
  const tag = f.tag.toLowerCase();
  const range = VIEWER_RANGES[f.viewers];

  const result = streams.filter(
    (s) =>
      (!f.language || s.language === f.language) &&
      (!tag || s.tags.some((t) => t.toLowerCase() === tag)) &&
      s.viewer_count >= range.min &&
      s.viewer_count <= range.max &&
      (!f.hideMature || !s.is_mature) &&
      (!f.favoritesOnly || favorites.has(s.user_login)) &&
      (!q || s.title.toLowerCase().includes(q) || s.user_name.toLowerCase().includes(q) || s.user_login.includes(q)),
  );

  const compare = compareBySort[f.sort];
  return result.sort(
    (a, b) => Number(favorites.has(b.user_login)) - Number(favorites.has(a.user_login)) || compare(a, b),
  );
}

/** Distinct languages, alphabetically. */
export function languagesOf(streams: readonly Stream[]): string[] {
  return [...new Set(streams.map((s) => s.language))].filter(Boolean).sort();
}

/** Most common tags first. */
export function topTags(streams: readonly Stream[], limit = 40): string[] {
  const counts = new Map<string, number>();
  for (const s of streams) for (const t of s.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([t]) => t);
}
