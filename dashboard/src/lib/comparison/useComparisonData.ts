import { useState, useEffect } from 'react';
import type { UseDataResult } from './types';

/**
 * Generic data-fetching hook with AbortController cleanup.
 * Follows the same useEffect + fetch pattern as ResultsSlide.
 */
export function useComparisonData<T>(
  path: string,
  validate?: (json: unknown) => json is T,
): UseDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetch(path, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load data (${res.status})`);
        return res.text();
      })
      .then((text) => {
        // Sanitize Python-style NaN/Infinity which are not valid JSON
        const sanitized = text
          .replace(/\bNaN\b/g, 'null')
          .replace(/\b-Infinity\b/g, 'null')
          .replace(/\bInfinity\b/g, 'null');
        return JSON.parse(sanitized) as unknown;
      })
      .then((json: unknown) => {
        if (validate && !validate(json)) {
          throw new Error('Unexpected data format');
        }
        setData(json as T);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load results');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [path, validate]);

  return { data, error, loading };
}
