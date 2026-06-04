import { useState, useEffect } from 'react';

/**
 * Generic data-fetching hook for slide components.
 * Returns fallback data immediately so slides always render without spinners.
 * Fetches from the public data directory on mount and updates when data arrives.
 */
export function useSlideData<T>(path: string, fallback: T): {
  data: T;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = `${import.meta.env.BASE_URL}${path}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then((json: T) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          console.warn(`[useSlideData] Failed to load ${path}:`, err.message);
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return { data, loading, error };
}
