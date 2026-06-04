import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Reads a query param on mount and writes it back on change with
 * `{ replace: true }` so deep-linking never spams browser history.
 *
 * Returns `[value, setValue]` like `useState`. The value is derived directly
 * from the search params (no second `useState` mirror), so there is no effect
 * loop and no risk of the two drifting. An unknown or garbage param falls back
 * to the default, mirroring the clamp-to-default idiom the v8 readers use.
 *
 * Writing the fallback value deletes the key, which keeps shared URLs clean
 * (an un-deep-linked default view has no query string).
 */
export function useQueryParamState<T extends string>(
  key: string,
  fallback: T,
  isValid: (v: string) => v is T,
): [T, (next: T) => void] {
  const [sp, setSp] = useSearchParams();

  const raw = sp.get(key);
  const value: T = raw != null && isValid(raw) ? raw : fallback;

  const setValue = useCallback(
    (next: T) => {
      const params = new URLSearchParams(sp);
      if (next === fallback) {
        params.delete(key);
      } else {
        params.set(key, next);
      }
      setSp(params, { replace: true });
    },
    [sp, setSp, key, fallback],
  );

  return [value, setValue];
}
