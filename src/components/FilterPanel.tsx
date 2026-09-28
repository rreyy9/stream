import { controlClass } from '../lib/styles';
import { DEFAULT_FILTERS, VIEWER_RANGES, type Filters, type ViewerRange } from '../lib/filters';

interface Props {
  filters: Filters;
  languages: string[];
  tags: string[];
  favoriteCount: number;
  onChange: (patch: Partial<Filters>) => void;
}

export function FilterPanel({ filters, languages, tags, favoriteCount, onChange }: Props) {
  // Keep a tag chosen from a card selectable even if it isn't among the top tags.
  const tagOptions = filters.tag && !tags.includes(filters.tag) ? [filters.tag, ...tags] : tags;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Language" value={filters.language} onChange={(e) => onChange({ language: e.target.value })} className={controlClass}>
        <option value="">All languages</option>
        {languages.map((l) => (
          <option key={l} value={l}>
            {l.toUpperCase()}
          </option>
        ))}
      </select>

      <select aria-label="Tag" value={filters.tag} onChange={(e) => onChange({ tag: e.target.value })} className={`${controlClass} max-w-48`}>
        <option value="">All tags</option>
        {tagOptions.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <select
        aria-label="Viewer count"
        value={filters.viewers}
        onChange={(e) => onChange({ viewers: e.target.value as ViewerRange })}
        className={controlClass}
      >
        {Object.entries(VIEWER_RANGES).map(([key, r]) => (
          <option key={key} value={key}>
            {r.label}
          </option>
        ))}
      </select>

      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-300 hover:bg-gray-700">
        <input
          type="checkbox"
          checked={filters.hideMature}
          onChange={(e) => onChange({ hideMature: e.target.checked })}
          className="size-4 accent-purple-600"
        />
        Hide 18+
      </label>

      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-300 hover:bg-gray-700">
        <input
          type="checkbox"
          checked={filters.favoritesOnly}
          onChange={(e) => onChange({ favoritesOnly: e.target.checked })}
          className="size-4 accent-purple-600"
        />
        Favorites only{favoriteCount > 0 && <span className="text-gray-500">({favoriteCount})</span>}
      </label>

      <button
        type="button"
        onClick={() =>
          onChange({
            language: DEFAULT_FILTERS.language,
            tag: DEFAULT_FILTERS.tag,
            viewers: DEFAULT_FILTERS.viewers,
            hideMature: DEFAULT_FILTERS.hideMature,
            favoritesOnly: DEFAULT_FILTERS.favoritesOnly,
          })
        }
        className="px-2 py-2 text-sm text-purple-300 hover:text-purple-200 hover:underline"
      >
        Clear filters
      </button>
    </div>
  );
}
