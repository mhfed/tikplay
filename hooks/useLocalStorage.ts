import { useCallback, useEffect, useState } from 'react';

/**
 * Typed localStorage-backed state hook for client components.
 *
 * SSR safe: on the server (and the very first client render) the `initial`
 * value is used, then a `useEffect` reads the persisted value after mount so
 * there is no hydration mismatch.
 *
 * @returns a tuple of [value, setValue, hydrated] where `hydrated` is true once
 * the persisted value has been read from localStorage.
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
): readonly [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  // Read the persisted value after mount (client only).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      // Ignore malformed JSON or unavailable storage.
    }
    setHydrated(true);
  }, [key]);

  // Persist on change, but only after the initial read completed.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore write errors (private mode / quota exceeded).
    }
  }, [key, value, hydrated]);

  const set = useCallback((v: T | ((prev: T) => T)) => setValue(v), []);

  return [value, set, hydrated] as const;
}
