import { describe, expect, it } from 'vitest';
import { activeFilterCount, applyFilters, DEFAULT_FILTERS, languagesOf, topTags, type Filters } from '../src/lib/filters';
import type { Stream } from '../src/types/twitch';

const stream = (overrides: Partial<Stream>): Stream => ({
  id: overrides.user_login ?? 'x',
  user_login: 'x',
  user_name: 'X',
  title: '',
  viewer_count: 0,
  started_at: '2026-01-01T00:00:00Z',
  language: 'en',
  thumbnail_url: '',
  game_name: 'Game',
  is_mature: false,
  tags: [],
  ...overrides,
});

const streams = [
  stream({ user_login: 'alpha', user_name: 'Alpha', title: 'Mythic raid night', viewer_count: 5000, language: 'en', tags: ['English', 'Raid'], started_at: '2026-01-01T10:00:00Z' }),
  stream({ user_login: 'bravo', user_name: 'Bravo', title: 'PvP arena', viewer_count: 50, language: 'de', tags: ['Deutsch'], is_mature: true, started_at: '2026-01-01T12:00:00Z' }),
  stream({ user_login: 'charlie', user_name: 'ÇharlieTV', title: 'leveling', viewer_count: 5, language: 'en', tags: ['english'], started_at: '2026-01-01T11:00:00Z' }),
  stream({ user_login: 'delta', user_name: 'Delta', title: 'raid prep', viewer_count: 20_000, language: 'fr', started_at: '2026-01-01T09:00:00Z' }),
];

const run = (patch: Partial<Filters>, favorites: string[] = []) =>
  applyFilters(streams, { ...DEFAULT_FILTERS, ...patch }, new Set(favorites)).map((s) => s.user_login);

describe('applyFilters', () => {
  it('sorts by viewers descending by default', () => {
    expect(run({})).toEqual(['delta', 'alpha', 'bravo', 'charlie']);
  });

  it('supports ascending and newest sorts', () => {
    expect(run({ sort: 'viewers-asc' })).toEqual(['charlie', 'bravo', 'alpha', 'delta']);
    expect(run({ sort: 'newest' })).toEqual(['bravo', 'charlie', 'alpha', 'delta']);
  });

  it('searches title, display name and login case-insensitively', () => {
    expect(run({ search: 'RAID' })).toEqual(['delta', 'alpha']);
    expect(run({ search: 'çharlie' })).toEqual(['charlie']);
    expect(run({ search: 'bravo' })).toEqual(['bravo']);
  });

  it('filters by language', () => {
    expect(run({ language: 'en' })).toEqual(['alpha', 'charlie']);
  });

  it('filters by tag case-insensitively', () => {
    expect(run({ tag: 'English' })).toEqual(['alpha', 'charlie']);
  });

  it('filters by viewer range (inclusive bounds)', () => {
    expect(run({ viewers: 'lt-10' })).toEqual(['charlie']);
    expect(run({ viewers: '10-100' })).toEqual(['bravo']);
    expect(run({ viewers: '1k-10k' })).toEqual(['alpha']);
    expect(run({ viewers: '10k+' })).toEqual(['delta']);
  });

  it('hides mature streams', () => {
    expect(run({ hideMature: true })).not.toContain('bravo');
  });

  it('pins favorites to the top, keeping sort order within each group', () => {
    expect(run({}, ['charlie', 'bravo'])).toEqual(['bravo', 'charlie', 'delta', 'alpha']);
  });

  it('shows only favorites when requested', () => {
    expect(run({ favoritesOnly: true }, ['alpha'])).toEqual(['alpha']);
  });

  it('does not mutate the input array', () => {
    const before = streams.map((s) => s.id);
    run({ sort: 'viewers-asc' });
    expect(streams.map((s) => s.id)).toEqual(before);
  });
});

describe('helpers', () => {
  it('counts active narrowing filters', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, search: 'x', sort: 'newest' })).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, language: 'en', hideMature: true, viewers: '10k+' })).toBe(3);
  });

  it('lists distinct languages alphabetically', () => {
    expect(languagesOf(streams)).toEqual(['de', 'en', 'fr']);
  });

  it('ranks tags by frequency', () => {
    const tagged = [stream({ tags: ['b', 'a'] }), stream({ tags: ['a'] }), stream({ tags: ['c'] })];
    expect(topTags(tagged)).toEqual(['a', 'b', 'c']);
    expect(topTags(tagged, 1)).toEqual(['a']);
  });
});
