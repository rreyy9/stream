import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS } from '../src/lib/filters';
import { DEFAULT_CATEGORY_ID, readUrlState, toQueryString } from '../src/lib/urlState';

describe('url state', () => {
  it('uses defaults for an empty query string', () => {
    expect(readUrlState('')).toEqual({ category: DEFAULT_CATEGORY_ID, filters: DEFAULT_FILTERS });
    expect(toQueryString(DEFAULT_CATEGORY_ID, DEFAULT_FILTERS)).toBe('');
  });

  it('round-trips every field', () => {
    const filters = {
      search: 'raid night',
      language: 'de',
      tag: 'Deutsch',
      viewers: '100-1k',
      hideMature: true,
      favoritesOnly: true,
      sort: 'newest',
    } as const;
    const qs = toQueryString('509658', filters);
    expect(readUrlState(qs)).toEqual({ category: '509658', filters });
  });

  it('ignores invalid values', () => {
    const { category, filters } = readUrlState('?c=abc&sort=bogus&v=999');
    expect(category).toBe(DEFAULT_CATEGORY_ID);
    expect(filters.sort).toBe(DEFAULT_FILTERS.sort);
    expect(filters.viewers).toBe(DEFAULT_FILTERS.viewers);
  });
});
