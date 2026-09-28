import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { GameCategory } from '../types/twitch';

interface Props {
  categories: GameCategory[];
  active: string;
  activeLabel: string;
  onSelect: (id: string) => void;
  onAdd: (category: GameCategory) => void;
  onRemove: (id: string) => void;
}

export function CategoryBar({ categories, active, activeLabel, onSelect, onAdd, onRemove }: Props) {
  const list = categories.some((c) => c.id === active) ? categories : [...categories, { id: active, name: activeLabel }];

  return (
    <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Category">
      {list.map((c) => {
        const selected = c.id === active;
        return (
          <div
            key={c.id}
            className={`flex items-center rounded-full text-sm font-medium transition ${
              selected ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/40' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelect(c.id)}
              className={`py-1.5 pl-4 ${list.length > 1 ? 'pr-1' : 'pr-4'}`}
            >
              {c.name}
            </button>
            {list.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(c.id)}
                aria-label={`Remove ${c.name}`}
                className="mr-1 rounded-full px-2 py-1 opacity-60 hover:bg-black/20 hover:opacity-100"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <CategorySearch onPick={onAdd} />
    </div>
  );
}

function CategorySearch({ onPick }: { onPick: (c: GameCategory) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Results are tagged with the query they answer, so Enter never picks a stale match.
  const [results, setResults] = useState<{ query: string; items: GameCategory[] }>({ query: '', items: [] });
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Debounced search; with an empty query it shows the current top categories.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const q = query.trim();
    const timer = setTimeout(
      () => {
        setStatus('loading');
        fetch(`/api/categories${q ? `?q=${encodeURIComponent(q)}` : ''}`, { signal: controller.signal })
          .then((res) => (res.ok ? (res.json() as Promise<{ categories: GameCategory[] }>) : Promise.reject(new Error())))
          .then((data) => {
            setResults({ query: q, items: data.categories });
            setHighlight(0);
            setStatus('idle');
          })
          .catch(() => {
            if (!controller.signal.aborted) setStatus('error');
          });
      },
      q ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  const current = results.query === query.trim() ? results.items : [];

  const pick = (c: GameCategory) => {
    onPick(c);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setHighlight((h) => (current.length ? (h + delta + current.length) % current.length : 0));
    } else if (e.key === 'Enter' && open && current[highlight]) {
      e.preventDefault();
      pick(current[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative w-full sm:w-56">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Add a category"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && current[highlight] ? `${listId}-${highlight}` : undefined}
        placeholder="+ Add category…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="w-full rounded-full border border-dashed border-gray-600 bg-transparent px-4 py-1.5 text-sm text-gray-200 placeholder-gray-400 outline-none focus:border-solid focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-80 w-full min-w-64 overflow-y-auto rounded-lg border border-gray-700 bg-gray-800 py-1 shadow-xl"
        >
          {(status === 'loading' || results.query !== query.trim()) && current.length === 0 && status !== 'error' && <li className="px-3 py-2 text-sm text-gray-400">Searching…</li>}
          {status === 'error' && <li className="px-3 py-2 text-sm text-red-300">Search failed</li>}
          {status === 'idle' && results.query === query.trim() && current.length === 0 && <li className="px-3 py-2 text-sm text-gray-400">No categories found</li>}
          {current.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === highlight}
              // mousedown (not click) so the pick happens before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm ${
                i === highlight ? 'bg-purple-600/30 text-white' : 'text-gray-200'
              }`}
            >
              {c.box_art_url && (
                <img
                  src={c.box_art_url.replace('{width}', '52').replace('{height}', '72')}
                  alt=""
                  width={26}
                  height={36}
                  className="h-9 w-[26px] shrink-0 rounded-sm bg-gray-700 object-cover"
                />
              )}
              <span className="truncate">{c.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
