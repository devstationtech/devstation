/// <reference types="@types/react" />
import { useCallback, useState } from "react";

// Module-level cache: survives component mount/unmount within a session,
// dies when the CLI process exits. Keys must be unique per logical view
// (e.g. include cluster id, node id) to avoid bleeding between contexts.
const cache = new Map<string, unknown>();

export function useNavigationState<T>(
  key: string,
  initial: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => (cache.has(key) ? (cache.get(key) as T) : initial));

  const set = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const next = typeof value === "function" ? (value as (p: T) => T)(prev) : value;
      cache.set(key, next);
      return next;
    });
  }, [key]);

  return [state, set];
}
