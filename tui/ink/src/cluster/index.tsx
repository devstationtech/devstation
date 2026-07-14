/// <reference types="@types/react" />
import { useCallback, useEffect, useState } from "react";
import { useInput } from "ink";
import type { ClusterRecord as Record } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { useCluster } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { RegisterClusterForm } from "@ui/cluster/register-form.tsx";
import { ConfirmDeleteScreen } from "@ui/shared/confirm-delete-screen.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { ScreenFrame, Table } from "@ui/shared/design-system/mod.ts";
import { useNavigationState } from "@ui/shared/hooks/use-navigation-state.ts";
import { ClusterDetailScreen } from "@ui/cluster/detail.tsx";
import { DimText } from "@ui/shared/theme/mod.ts";

type Subscreen = "list" | "new" | "detail" | "confirm-delete";

type Props = {
  onBack: () => void;
};

export function ClusterScreen({ onBack }: Props) {
  const cluster = useCluster();
  const sessionId = useSessionId();
  const [clusters, setClusters] = useState<readonly Record[] | null>(null);
  const [cursor, setCursor] = useNavigationState<number>("clusters:cursor", 0);
  const [subscreen, setSubscreen] = useState<Subscreen>("list");

  const reload = useCallback(() =>
    cluster.list({ sessionId }).then((list) => {
      setClusters(list);
      setCursor((c) => Math.min(c, Math.max(0, list.length - 1)));
    }), [cluster, sessionId, setCursor]);

  useEffect(() => {
    reload();
  }, [reload]);

  const highlighted = clusters && clusters.length > 0 ? clusters[cursor] : null;

  useInput((input, key) => {
    if (subscreen !== "list") return;
    if (key.escape) {
      onBack();
      return;
    }
    if (key.ctrl || key.meta) return;
    if (input === "r") {
      setSubscreen("new");
      return;
    }
    if (!clusters || clusters.length === 0) return;
    if (key.return) {
      setSubscreen("detail");
      return;
    }
    if (input === "u") {
      setSubscreen("confirm-delete");
      return;
    }
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) setCursor((c) => Math.min(clusters.length - 1, c + 1));
  });

  if (subscreen === "new") {
    return (
      <RegisterClusterForm
        onBack={() => setSubscreen("list")}
        onCreated={() => {
          setSubscreen("list");
          reload();
        }}
      />
    );
  }

  if (subscreen === "detail" && highlighted) {
    return (
      <ClusterDetailScreen
        clusterId={highlighted.id}
        clusterName={highlighted.name}
        provider={highlighted.provider}
        onBack={() => {
          setSubscreen("list");
          reload();
        }}
      />
    );
  }

  if (subscreen === "confirm-delete" && highlighted) {
    return (
      <ConfirmDeleteScreen
        title="delete cluster"
        itemId={highlighted.name}
        entityLabel="cluster"
        onDelete={() => cluster.unregister({ sessionId, id: highlighted.id })}
        onConfirmed={() => {
          setSubscreen("list");
          reload();
        }}
        onBack={() => setSubscreen("list")}
      />
    );
  }

  const hasItems = (clusters?.length ?? 0) > 0;
  const statisticsFor = (c: Record): string => {
    if (c.provider === "proxmox" && c.proxmox) {
      const { nodeCount, virtualMachineCount } = c.proxmox;
      return `${nodeCount} node${nodeCount === 1 ? "" : "s"}, ${virtualMachineCount} vm${
        virtualMachineCount === 1 ? "" : "s"
      }`;
    }
    return "—";
  };
  const rows = (clusters ?? []).map((c) => ({
    name: c.name,
    provider: c.provider,
    connected: c.connected ? "yes" : "no",
    statistics: statisticsFor(c),
    version: `v${c.version}`,
  }));

  return (
    <ScreenFrame
      breadcrumb={["topologies", "clusters"]}
      footer={
        <HelpBar>
          {hasItems ? "r register   ↵ open   u unregister   esc back" : "r register   esc back"}
        </HelpBar>
      }
    >
      {clusters === null ? <DimText>Loading...</DimText> : (
        <Table
          rows={rows}
          columns={[
            { key: "name" },
            { key: "provider" },
            { key: "connected" },
            { key: "statistics" },
            { key: "version", align: "right" },
          ]}
          focusedIndex={hasItems ? cursor : undefined}
          emptyMessage="No clusters found. Press r to register one."
        />
      )}
    </ScreenFrame>
  );
}
