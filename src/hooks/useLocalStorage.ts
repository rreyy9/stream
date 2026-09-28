import { useEffect, useState } from 'react';

/** useState persisted to localStorage. Falls back to in-memory state when storage is unavailable. */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or blocked (private mode) – keep working in memory.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
