import { useEffect, useRef, useState, useCallback } from "react";

export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number = 30000,
  enabled: boolean = true,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const result = await fetcher();
      if (mountedRef.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetcher]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    fetchData();

    if (enabled && intervalMs > 0) {
      intervalRef.current = setInterval(fetchData, intervalMs);
    }

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, intervalMs, enabled]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh };
}
