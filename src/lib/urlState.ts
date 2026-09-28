import { DEFAULT_FILTERS, SORTS, VIEWER_RANGES, type Filters, type SortKey, type ViewerRange } from './filters';

export const DEFAULT_CATEGORY_ID = '18122'; // World of Warcraft

/** Reads the selected category and filters from a query string (for shareable links). */
export function readUrlState(search: string): { category: string; filters: Filters } {
  const p = new URLSearchParams(search);
  const sort = p.get('sort');
  const viewers = p.get('v');
  const category = p.get('c');

  return {
    category: category && /^\d+$/.test(category) ? category : DEFAULT_CATEGORY_ID,
    filters: {
      search: p.get('q') ?? DEFAULT_FILTERS.search,
      language: p.get('lang') ?? DEFAULT_FILTERS.language,
      tag: p.get('tag') ?? DEFAULT_FILTERS.tag,
      viewers: viewers && viewers in VIEWER_RANGES ? (viewers as ViewerRange) : DEFAULT_FILTERS.viewers,
      hideMature: p.get('hide18') === '1',
      favoritesOnly: p.get('fav') === '1',
      sort: sort && sort in SORTS ? (sort as SortKey) : DEFAULT_FILTERS.sort,
    },
  };
}

/** Serializes state to a query string, omitting defaults to keep URLs short. */
export function toQueryString(category: string, f: Filters): string {
  const p = new URLSearchParams();
  if (category !== DEFAULT_CATEGORY_ID) p.set('c', category);
  if (f.search) p.set('q', f.search);
  if (f.language) p.set('lang', f.language);
  if (f.tag) p.set('tag', f.tag);
  if (f.viewers !== DEFAULT_FILTERS.viewers) p.set('v', f.viewers);
  if (f.hideMature) p.set('hide18', '1');
  if (f.favoritesOnly) p.set('fav', '1');
  if (f.sort !== DEFAULT_FILTERS.sort) p.set('sort', f.sort);
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}
