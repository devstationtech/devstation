/// <reference types="@types/react" />
import { useEffect, useState } from "react";
import type { AuthResourcesResponse } from "@jsonrpc-contracts-ts/auth.gen.ts";
import { useOptionalRpcClients } from "@ui/rpc-clients-provider.tsx";

// Polls the public host-resources query (auth.resources) at a fixed
// cadence and exposes the latest snapshot to the UI header. The
// server-side query keeps the previous /proc/stat reading internally,
// so the first call returns 0% and subsequent calls return the delta.
//
// Non-critical: when rendered outside the RPC provider (DI-free smoke
// tests, or before the app tree mounts) it simply stays null and never
// polls — the header just omits the stats line.
export function useSystemStats(intervalMs = 2000): AuthResourcesResponse | null {
  const clients = useOptionalRpcClients();
  const [stats, setStats] = useState<AuthResourcesResponse | null>(null);
  useEffect(() => {
    if (!clients) return;
    let mounted = true;
    const tick = async () => {
      try {
        const snapshot = await clients.auth.resources({});
        if (mounted) setStats(snapshot);
      } catch { /* swallow — local stats are non-critical */ }
    };
    void tick();
    const id = setInterval(() => void tick(), intervalMs);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [clients, intervalMs]);
  return stats;
}
