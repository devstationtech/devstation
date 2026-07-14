/// <reference types="@types/react" />
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import { SubprocessCall } from "@jsonrpc-client-ts/mod.ts";
import { denoRuntime } from "@ui/shared/platform/mod.ts";
import { resolveEngineCommand } from "@ui/embedded-server.ts";
import { SessionExpiryClient } from "@ui/shared/session-expiry-client.ts";
import { AuthIntegration } from "@ui/shared/integrations/auth-integration.ts";
import { SizeIntegration } from "@ui/shared/integrations/size-integration.ts";
import { VaultIntegration } from "@ui/shared/integrations/vault-integration.ts";
import { ExecutionsIntegration } from "@ui/shared/integrations/executions-integration.ts";
import { ClusterEventIntegration } from "@ui/shared/integrations/cluster-event-integration.ts";
import { ClusterIntegration } from "@ui/shared/integrations/cluster-integration.ts";
import { ImageIntegration } from "@ui/shared/integrations/image-integration.ts";
import { StationIntegration } from "@ui/shared/integrations/station-integration.ts";
import { BlueprintIntegration } from "@ui/shared/integrations/blueprint-integration.ts";

/**
 * Long-lived RPC clients for the engine subprocess.
 *
 * Constructed ONCE per UI session (provider mount). React Context makes it
 * obvious in the tree that every screen shares the same instance — no
 * accidental respawning, no "is this being reconfigured per screen?" doubt
 * you might get from singleton module imports.
 *
 * Engine binary discovery is handled by `resolveEngineCommand` in
 * `embedded-server.ts` — in a release build it extracts the bundled
 * server from the binary's embedded assets; in dev mode it falls back
 * to the standalone source entry. `$DEVSTATION_SERVER` overrides
 * either path explicitly.
 */
export interface RpcClients {
  readonly rpc: Client;
  readonly auth: AuthIntegration;
  readonly size: SizeIntegration;
  readonly operations: ExecutionsIntegration;
  readonly clusterEvents: ClusterEventIntegration;
  readonly cluster: ClusterIntegration;
  readonly image: ImageIntegration;
  readonly station: StationIntegration;
  readonly blueprint: BlueprintIntegration;
  readonly vault: VaultIntegration;
}

const RpcClientsContext = createContext<RpcClients | null>(null);

type EngineCommand = { readonly command: string; readonly args: readonly string[] };

export interface RpcClientsProviderProps {
  /** Test seam; production lets `resolveEngineCommand` figure it out. */
  readonly engineCommand?: EngineCommand;
  // Test/embedding seam: when provided, the subprocess spawn is skipped
  // and these clients are used as-is. Production never passes this.
  readonly clients?: RpcClients;
  readonly children: ReactNode;
}

export function RpcClientsProvider(
  { engineCommand, clients: injected, children }: RpcClientsProviderProps,
) {
  // resolveEngineCommand is async (it materializes the embedded asset on
  // first run); we defer the spawn until it resolves. While we wait, the
  // provider supplies `null` clients and screens that need them render
  // their loading state.
  const [resolved, setResolved] = useState<EngineCommand | null>(
    engineCommand ?? null,
  );
  useEffect(() => {
    if (resolved || injected) return;
    let cancelled = false;
    void resolveEngineCommand().then((cmd) => {
      if (!cancelled) setResolved(cmd);
    });
    return () => {
      cancelled = true;
    };
  }, [resolved, injected]);

  const { clients, subprocess } = useMemo(() => {
    if (injected) return { clients: injected, subprocess: null };
    if (!resolved) return { clients: null, subprocess: null };
    const subprocess = new SubprocessCall(
      resolved.command,
      resolved.args,
      denoRuntime.process.spawnChannel,
    );
    const rpc = new SessionExpiryClient(subprocess);
    const auth = new AuthIntegration(rpc);
    const size = new SizeIntegration(rpc);
    const operations = new ExecutionsIntegration(rpc);
    const clusterEvents = new ClusterEventIntegration(rpc);
    const cluster = new ClusterIntegration(rpc);
    const image = new ImageIntegration(rpc);
    const station = new StationIntegration(rpc);
    const blueprint = new BlueprintIntegration(rpc);
    const vault = new VaultIntegration(rpc);
    return {
      clients: {
        rpc,
        auth,
        size,
        operations,
        clusterEvents,
        cluster,
        image,
        station,
        blueprint,
        vault,
      },
      subprocess,
    };
  }, [resolved, injected]);

  useEffect(() => () => {
    void subprocess?.shutdown();
  }, [subprocess]);

  // During engine resolution (asset extract on first run can take
  // ~200ms) children render nothing — keeps screens from seeing
  // `useRpcClients() === null` and crashing. The Ink runtime simply
  // shows an empty frame for that brief window. Production-grade
  // splash UX can layer on top.
  if (!clients) return null;

  return <RpcClientsContext.Provider value={clients}>{children}</RpcClientsContext.Provider>;
}

export function useRpcClients(): RpcClients {
  const clients = useContext(RpcClientsContext);
  if (clients === null) {
    throw new Error(
      "useRpcClients called outside <RpcClientsProvider>. Wrap the UI tree with the provider.",
    );
  }
  return clients;
}

/**
 * Non-throwing variant for non-critical widgets that may render outside
 * the provider (e.g. the header's host-stats poller in DI-free smoke
 * tests, or before the app tree is fully mounted). Returns `null`
 * instead of throwing so the caller can degrade gracefully.
 */
export function useOptionalRpcClients(): RpcClients | null {
  return useContext(RpcClientsContext);
}

export function useAuth(): AuthIntegration {
  return useRpcClients().auth;
}

export function useSize(): SizeIntegration {
  return useRpcClients().size;
}

export function useOperations(): ExecutionsIntegration {
  return useRpcClients().operations;
}

export function useClusterEvents(): ClusterEventIntegration {
  return useRpcClients().clusterEvents;
}

export function useCluster(): ClusterIntegration {
  return useRpcClients().cluster;
}

export function useImage(): ImageIntegration {
  return useRpcClients().image;
}

export function useStation(): StationIntegration {
  return useRpcClients().station;
}

export function useBlueprint(): BlueprintIntegration {
  return useRpcClients().blueprint;
}

export function useVault(): VaultIntegration {
  return useRpcClients().vault;
}
