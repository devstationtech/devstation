/// <reference types="@types/react" />
import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import chalk from "chalk";
import type {
  ClusterRecord,
  ProxmoxConnectionRecord,
  ProxmoxNodeRecord,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { useCluster } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { ProvisioningTab } from "@ui/cluster/providers/proxmox/provisioning-tab.tsx";
import {
  useIsRunning,
  useProvisioningHelp,
} from "@ui/cluster/providers/proxmox/provisioning-store.ts";
import { useSpinnerFrame } from "@ui/shared/hooks/use-spinner-frame.ts";
import { dotsSpinner } from "@ui/shared/design-system/mod.ts";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import { ConfirmDeleteScreen } from "@ui/shared/confirm-delete-screen.tsx";
import {
  emptyBar,
  formatGiB,
  formatUptime,
  labeledBar,
  pct,
  ScreenFrame,
  statusDot,
  TabBar,
  Table,
} from "@ui/shared/design-system/mod.ts";
import { useNavigationState } from "@ui/shared/hooks/use-navigation-state.ts";
import { NodeForm } from "@ui/cluster/providers/proxmox/node-form.tsx";
import { NodeDetailScreen } from "@ui/cluster/providers/proxmox/node-detail.tsx";
import { SetupProviderForm } from "@ui/cluster/providers/proxmox/setup-provider-form.tsx";
import { DimText, dimText } from "@ui/shared/theme/mod.ts";

type Subscreen =
  | "list"
  | "node-new"
  | "node-edit"
  | "node-confirm-delete"
  | "node-confirm-delete-all"
  | "node-virtualMachines"
  | "setup-provider"
  | "disconnect-provider";

type Props = {
  clusterId: string;
  clusterName: string;
  onBack: () => void;
};

export function ProxmoxClusterDetailScreen({ clusterId, clusterName, onBack }: Props) {
  const clusterApi = useCluster();
  const sessionId = useSessionId();
  const [cluster, setCluster] = useState<ClusterRecord | null>(null);
  const [nodes, setNodes] = useState<readonly ProxmoxNodeRecord[]>([]);
  const [connections, setConnections] = useState<
    readonly ProxmoxConnectionRecord[]
  >([]);
  const [nodeCursor, setNodeCursor] = useNavigationState<number>(
    `cluster:${clusterId}:nodeCursor`,
    0,
  );
  const [subscreen, setSubscreen] = useState<Subscreen>("list");
  const [activeTab, setActiveTab] = useNavigationState<string>(
    `cluster:${clusterId}:activeTab`,
    "nodes",
  );

  const reload = useCallback(async () => {
    // Each section loads independently: a slow/failing provider call on
    // one (e.g. nodes enrichment) must not blank the others. Previously
    // these were awaited in series under one try, so any rejection left
    // the whole screen empty while the file-only provisioning tab worked.
    const [recordR, connsR, nodesR] = await Promise.allSettled([
      clusterApi.byId({ sessionId, id: clusterId }),
      clusterApi.connectionsList({ sessionId, clusterId }),
      clusterApi.nodesList({ sessionId, clusterId }),
    ]);
    if (recordR.status === "fulfilled") setCluster(recordR.value);
    if (connsR.status === "fulfilled") setConnections(connsR.value);
    if (nodesR.status === "fulfilled") {
      const sortedNodes = [...nodesR.value].sort((a, b) => a.name.localeCompare(b.name));
      setNodes(sortedNodes);
      setNodeCursor((c) => Math.min(c, Math.max(0, sortedNodes.length - 1)));
    }
  }, [clusterApi, sessionId, clusterId]);

  const AUTO_REFRESH_MS = 5_000;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subscreenRef = useRef(subscreen);
  subscreenRef.current = subscreen;

  useEffect(() => {
    reload().catch(() => {/* AuthGate handles session-expired */});
    intervalRef.current = setInterval(() => {
      if (subscreenRef.current === "list") {
        reload().catch(() => {/* AuthGate handles session-expired */});
      }
    }, AUTO_REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const selectedNode = nodes.length > 0 ? nodes[nodeCursor] : null;
  const hasConnection = connections.length > 0;
  const activeConnection = connections[0] ?? null;

  // Cluster-level shortcuts (active in any tab)
  const TAB_ORDER = ["nodes", "provisioning"];
  useInput((input, key) => {
    if (subscreen !== "list") return;
    if (key.escape) {
      // Provisioning tab handles esc internally (cascades steps before bubbling out).
      if (activeTab === "provisioning") return;
      onBack();
      return;
    }
    if (key.leftArrow) {
      const idx = TAB_ORDER.indexOf(activeTab);
      if (idx > 0) setActiveTab(TAB_ORDER[idx - 1]);
      return;
    }
    if (key.rightArrow) {
      const idx = TAB_ORDER.indexOf(activeTab);
      if (idx >= 0 && idx < TAB_ORDER.length - 1) setActiveTab(TAB_ORDER[idx + 1]);
      return;
    }
    if (key.ctrl || key.meta) return;
    if (activeTab === "provisioning") return;
    if (input === "c" && !hasConnection) {
      setSubscreen("setup-provider");
      return;
    }
    if (input === "d" && hasConnection) {
      setSubscreen("disconnect-provider");
      return;
    }
  });

  const provisioningRunning = useIsRunning(clusterId);
  const spinnerFrame = useSpinnerFrame(
    dotsSpinner.frames,
    200,
    provisioningRunning,
  );
  const provisioningHelp = useProvisioningHelp(clusterId);

  // Subscreens (full-screen takeovers)
  if (subscreen === "node-new") {
    return (
      <NodeForm
        mode="create"
        clusterId={clusterId}
        clusterName={clusterName}
        onBack={() => setSubscreen("list")}
        onSaved={() => {
          setSubscreen("list");
          reload();
        }}
      />
    );
  }

  if (subscreen === "node-edit" && selectedNode) {
    return (
      <NodeForm
        mode="edit"
        clusterId={clusterId}
        clusterName={clusterName}
        node={{
          id: selectedNode.id,
          name: selectedNode.name,
          ip: selectedNode.ip,
          vaultId: selectedNode.credential.vaultId,
          usernameSecretId: selectedNode.credential.usernameSecretId,
          passwordSecretId: selectedNode.credential.passwordSecretId,
        }}
        onBack={() => setSubscreen("list")}
        onSaved={() => {
          setSubscreen("list");
          reload();
        }}
      />
    );
  }

  if (subscreen === "node-confirm-delete" && selectedNode) {
    return (
      <ConfirmDeleteScreen
        title="unregister node"
        itemId={selectedNode.name}
        entityLabel="node"
        onDelete={() =>
          clusterApi.nodesUnregister({
            sessionId,
            clusterId,
            nodeId: selectedNode.id,
          })}
        onConfirmed={() => {
          setSubscreen("list");
          reload();
        }}
        onBack={() => setSubscreen("list")}
      />
    );
  }

  if (subscreen === "node-confirm-delete-all") {
    return (
      <ConfirmDeleteScreen
        title="unregister all nodes"
        itemId={clusterName}
        entityLabel="all nodes from cluster"
        onDelete={() => clusterApi.nodesUnregisterAll({ sessionId, clusterId })}
        onConfirmed={() => {
          setSubscreen("list");
          reload();
        }}
        onBack={() => setSubscreen("list")}
      />
    );
  }

  if (subscreen === "disconnect-provider" && activeConnection) {
    return (
      <ConfirmDeleteScreen
        title="disconnect proxmox"
        itemId="disconnect"
        entityLabel="proxmox provider from cluster"
        onDelete={() => clusterApi.disconnect({ sessionId, clusterId })}
        onConfirmed={() => {
          setSubscreen("list");
          reload();
        }}
        onBack={() => setSubscreen("list")}
      />
    );
  }

  if (subscreen === "node-virtualMachines" && selectedNode) {
    return (
      <NodeDetailScreen
        clusterId={clusterId}
        clusterName={clusterName}
        nodeId={selectedNode.id}
        nodeName={selectedNode.name}
        nodeAddress={selectedNode.ip}
        primaryConnection={activeConnection}
        onBack={() => setSubscreen("list")}
      />
    );
  }

  if (subscreen === "setup-provider") {
    return (
      <SetupProviderForm
        clusterId={clusterId}
        clusterName={clusterName}
        onBack={() => setSubscreen("list")}
        onDone={() => {
          setSubscreen("list");
          reload();
        }}
      />
    );
  }

  // Default: tabbed list view
  const hasNodes = nodes.length > 0;

  const tabHelp = activeTab === "nodes"
    ? (hasNodes ? "↵ open   r register   e edit   u unregister   x unregister all" : "r register")
    : provisioningHelp;

  const globalHelpParts = ["←→ tabs"];
  if (activeTab !== "provisioning") {
    if (!hasConnection) globalHelpParts.push("c connect");
    else globalHelpParts.push("d disconnect");
    globalHelpParts.push("esc back");
  } else {
    globalHelpParts.push("esc back");
  }

  const footer = <HelpBar>{[tabHelp, ...globalHelpParts].join("   ")}</HelpBar>;

  const connectionLine = hasConnection
    ? (
      <Box gap={1}>
        <Text color="green">●</Text>
        <DimText>{cluster?.provider ?? ""} connected</DimText>
        <DimText>—</DimText>
        <DimText>{activeConnection!.host}</DimText>
      </Box>
    )
    : <DimText>○ no provider connected</DimText>;

  // Legend rendered at the bottom of the nodes tab body. Single Text with
  // chalk so the spacing between items doesn't get eaten by Box layout.
  // Wording mirrors the VM legend (running/stopped) for vocabulary
  // consistency, even though the underlying Proxmox node status is
  // online/offline (mapped via the `tone` lookup below).
  const nodeLegend = hasConnection && activeTab === "nodes"
    ? (
      <Text>
        {" "}
        {chalk.green("● running")} {chalk.red("● stopped")} {dimText("● not found")}
        {" "}
      </Text>
    )
    : undefined;
  // Visible char count: leading space + "● running" (9) + 3 spaces + "● stopped" (9)
  // + 3 spaces + "● not found" (11) + trailing space = 37.
  const nodeLegendWidth = nodeLegend ? 37 : 0;

  const tabBar = (
    <TabBar
      items={[
        { id: "nodes", label: "nodes" },
        {
          id: "provisioning",
          label: provisioningRunning ? `provisioning ${spinnerFrame}` : "provisioning",
        },
      ]}
      currentId={activeTab}
    />
  );

  return (
    <ScreenFrame
      breadcrumb={["topologies", clusterName]}
      header={tabBar}
      topRight={connectionLine}
      bottomRight={nodeLegend}
      bottomRightWidth={nodeLegendWidth}
      footer={footer}
    >
      {activeTab === "nodes" && (
        <NodesTab
          nodes={nodes}
          cursor={nodeCursor}
          setCursor={setNodeCursor}
          onSubscreen={setSubscreen}
        />
      )}
      <ProvisioningTab
        active={activeTab === "provisioning"}
        clusterId={clusterId}
        clusterName={clusterName}
        hasConnection={hasConnection}
        onBack={onBack}
      />
    </ScreenFrame>
  );
}

type NodesTabProps = {
  nodes: readonly ProxmoxNodeRecord[];
  cursor: number;
  setCursor: (c: number) => void;
  onSubscreen: (s: Subscreen) => void;
};

function NodesTab({ nodes, cursor, setCursor, onSubscreen }: NodesTabProps) {
  useInput((input, key) => {
    if (key.ctrl || key.meta) return;
    if (input === "r") {
      onSubscreen("node-new");
      return;
    }
    if (nodes.length === 0) return;
    if (key.return) {
      onSubscreen("node-virtualMachines");
      return;
    }
    if (input === "e") {
      onSubscreen("node-edit");
      return;
    }
    if (input === "u") {
      onSubscreen("node-confirm-delete");
      return;
    }
    if (input === "x") {
      onSubscreen("node-confirm-delete-all");
      return;
    }
    if (key.upArrow) setCursor(Math.max(0, cursor - 1));
    if (key.downArrow) setCursor(Math.min(nodes.length - 1, cursor + 1));
  });

  const rows = nodes.map((node) => {
    const live = node.resources.live;
    const tone = live?.status === "online" ? "ok" : live?.status === "offline" ? "danger" : "muted";
    return {
      "": statusDot(tone),
      name: node.name,
      ip: node.ip,
      cpu: live
        ? labeledBar(
          live.cpuPercent,
          `${live.cpuPercent}% of ${String(live.cpuCores).padStart(2)} CPU(s)`,
        )
        : emptyBar("—"),
      "ram (GiB)": live
        ? labeledBar(
          pct(live.ramUsedGiB, live.ramTotalGiB),
          `${pct(live.ramUsedGiB, live.ramTotalGiB)}% ${formatGiB(live.ramUsedGiB)}/${
            formatGiB(live.ramTotalGiB)
          }`,
        )
        : emptyBar("—"),
      "system disk (GiB)": live
        ? labeledBar(
          pct(live.diskUsedGiB, live.diskTotalGiB),
          `${pct(live.diskUsedGiB, live.diskTotalGiB)}% ${formatGiB(live.diskUsedGiB)}/${
            formatGiB(live.diskTotalGiB)
          }`,
        )
        : emptyBar("—"),
      uptime: live ? formatUptime(live.uptimeSeconds) : "—",
      virtualMachines: String(node.virtualMachineCount),
    };
  });

  return (
    <Table
      rows={rows}
      columns={[
        { key: "", bright: true },
        { key: "name" },
        { key: "ip" },
        { key: "cpu" },
        { key: "ram (GiB)" },
        { key: "system disk (GiB)" },
        { key: "uptime", align: "right" },
        { key: "virtualMachines", align: "right" },
      ]}
      focusedIndex={nodes.length > 0 ? cursor : undefined}
      emptyMessage="No nodes found. Press r to register one."
    />
  );
}
