/// <reference types="@types/react" />
import { useCallback, useEffect, useRef, useState } from "react";
import { Text, useInput } from "ink";
import chalk from "chalk";
import type {
  ProxmoxConnectionRecord,
  ProxmoxVirtualMachineRecord,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { useCluster } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
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
import { dimText } from "@ui/shared/theme/mod.ts";
import { VirtualMachineForm } from "@ui/cluster/providers/proxmox/virtual-machine-form.tsx";
import { VirtualMachineDetailScreen } from "@ui/cluster/providers/proxmox/virtual-machine-detail.tsx";
import { NodeImageAssignmentForm } from "@ui/cluster/providers/proxmox/node-image-assignment-form.tsx";

type Subscreen =
  | "list"
  | "vm-new"
  | "vm-edit"
  | "vm-detail"
  | "vm-confirm-delete"
  | "vm-confirm-delete-all"
  | "image-new"
  | "image-edit"
  | "image-confirm-delete";

type NodeAssignment = {
  imageId: string;
  imageName: string;
  virtualMachineId: number;
  storage: string;
};

type Props = {
  clusterId: string;
  clusterName: string;
  nodeId: string;
  nodeName: string;
  nodeAddress: string;
  primaryConnection: ProxmoxConnectionRecord | null;
  onBack: () => void;
};

export function NodeDetailScreen(
  { clusterId, clusterName, nodeId, nodeName, primaryConnection, onBack }: Props,
) {
  const clusterApi = useCluster();
  const sessionId = useSessionId();
  const [virtualMachines, setVirtualMachines] = useState<
    readonly ProxmoxVirtualMachineRecord[]
  >([]);
  const [assignments, setAssignments] = useState<NodeAssignment[]>([]);
  const [vmCursor, setVirtualMachineCursor] = useNavigationState<number>(
    `node:${nodeId}:vmCursor`,
    0,
  );
  const [imageCursor, setImageCursor] = useNavigationState<number>(
    `node:${nodeId}:imageCursor`,
    0,
  );
  const [subscreen, setSubscreen] = useState<Subscreen>("list");
  const [nodeState, setNodeState] = useState<string>("REGISTERED");
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useNavigationState<string>(
    `node:${nodeId}:activeTab`,
    "virtualMachines",
  );

  const reload = useCallback(async () => {
    const [virtualMachines, allImages, nodeRows] = await Promise.all([
      clusterApi.vmList({ sessionId, clusterId, nodeId }),
      clusterApi.imagesList({ sessionId, clusterId }),
      clusterApi.nodesList({ sessionId, clusterId }),
    ]);
    const self = nodeRows.find((n) => n.id === nodeId);
    if (self) setNodeState(self.state);
    const sortedVirtualMachines = [...virtualMachines].sort((a, b) => a.id - b.id);
    setVirtualMachines(sortedVirtualMachines);
    setVirtualMachineCursor((c) => Math.min(c, Math.max(0, sortedVirtualMachines.length - 1)));

    // `imagesList` is the cluster's per-node assignment view; keep only this node's.
    const nodeAssignments: NodeAssignment[] = allImages
      .filter((t) => t.nodeId === nodeId)
      .map((t) => ({
        imageId: t.imageId,
        imageName: t.name,
        virtualMachineId: t.virtualMachineId,
        storage: t.storage,
      }));
    nodeAssignments.sort((a, b) => a.imageName.localeCompare(b.imageName));
    setAssignments(nodeAssignments);
    setImageCursor((c) => Math.min(c, Math.max(0, nodeAssignments.length - 1)));
  }, [clusterApi, sessionId, clusterId, nodeId, primaryConnection]);

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

  const selectedVirtualMachine = virtualMachines.length > 0 ? virtualMachines[vmCursor] : null;
  const selectedAssignment = assignments.length > 0 ? assignments[imageCursor] : null;

  // Mirror the domain lock (NodeBusy): while the node is in-flight the
  // domain rejects VM mutations, so the UI must not offer them — open
  // read-only detail instead of a dead-end editor. PLAN_* stays free
  // (compose-then-replan), matching the domain's VM_LOCKED_STATES.
  const nodeBusy = nodeState === "APPLY_STARTED" || nodeState === "DESTROY_STARTED";
  const VM_MUTATING_SUBSCREENS: readonly Subscreen[] = [
    "vm-new",
    "vm-edit",
    "vm-confirm-delete",
    "vm-confirm-delete-all",
  ];
  const requestVirtualMachineSubscreen = (target: Subscreen) => {
    if (nodeBusy && VM_MUTATING_SUBSCREENS.includes(target)) {
      setNotice(
        `node is ${nodeState} — virtual machines are read-only until it finishes`,
      );
      if (target === "vm-edit") setSubscreen("vm-detail"); // read-only view
      return;
    }
    setNotice(null);
    setSubscreen(target);
  };

  useInput((_input, key) => {
    if (subscreen !== "list") return;
    if (key.escape) {
      onBack();
      return;
    }
    if (key.leftArrow && activeTab === "images") {
      setActiveTab("virtualMachines");
      return;
    }
    if (key.rightArrow && activeTab === "virtualMachines") {
      setActiveTab("images");
      return;
    }
  });

  if (subscreen === "vm-new") {
    return (
      <VirtualMachineForm
        mode="create"
        clusterId={clusterId}
        clusterName={clusterName}
        nodeId={nodeId}
        nodeName={nodeName}
        onBack={() => setSubscreen("list")}
        onSaved={() => {
          setSubscreen("list");
          reload();
        }}
      />
    );
  }

  if (subscreen === "vm-detail" && selectedVirtualMachine) {
    return (
      <VirtualMachineDetailScreen
        clusterId={clusterId}
        clusterName={clusterName}
        nodeId={nodeId}
        nodeName={nodeName}
        vm={selectedVirtualMachine}
        proxmoxHost={primaryConnection?.host ?? null}
        onBack={() => setSubscreen("list")}
      />
    );
  }

  if (subscreen === "vm-edit" && selectedVirtualMachine) {
    return (
      <VirtualMachineForm
        mode="edit"
        clusterId={clusterId}
        clusterName={clusterName}
        nodeId={nodeId}
        nodeName={nodeName}
        virtualMachine={{
          id: selectedVirtualMachine.id,
          name: selectedVirtualMachine.name,
          tags: [...selectedVirtualMachine.tags],
          size: selectedVirtualMachine.sizeId,
          image: selectedVirtualMachine.image,
          ip: selectedVirtualMachine.ip,
          gateway: selectedVirtualMachine.gateway,
          dns: selectedVirtualMachine.dns,
          storage: selectedVirtualMachine.storage,
          cpu: selectedVirtualMachine.resources.local.cpu,
          ram: selectedVirtualMachine.resources.local.ram,
          disk: selectedVirtualMachine.resources.local.disk,
          credentialVaultId: selectedVirtualMachine.credentialVaultId,
          usernameSecretId: selectedVirtualMachine.usernameSecretId,
          passwordSecretId: selectedVirtualMachine.passwordSecretId,
        }}
        onBack={() => setSubscreen("list")}
        onSaved={() => {
          setSubscreen("list");
          reload();
        }}
      />
    );
  }

  if (subscreen === "vm-confirm-delete" && selectedVirtualMachine) {
    return (
      <ConfirmDeleteScreen
        title="unregister virtual machine"
        itemId={selectedVirtualMachine.name}
        entityLabel="virtual machine"
        onDelete={() =>
          clusterApi.vmUnregister({
            sessionId,
            clusterId,
            nodeId,
            id: selectedVirtualMachine.id,
          })}
        onConfirmed={() => {
          setSubscreen("list");
          reload();
        }}
        onBack={() => setSubscreen("list")}
      />
    );
  }

  if (subscreen === "vm-confirm-delete-all") {
    return (
      <ConfirmDeleteScreen
        title="unregister all virtual machines"
        itemId={nodeName}
        entityLabel="all virtual machines from node"
        onDelete={() => clusterApi.vmUnregisterAll({ sessionId, clusterId, nodeId })}
        onConfirmed={() => {
          setSubscreen("list");
          reload();
        }}
        onBack={() => setSubscreen("list")}
      />
    );
  }

  if (subscreen === "image-new") {
    return (
      <NodeImageAssignmentForm
        mode="create"
        clusterId={clusterId}
        clusterName={clusterName}
        nodeId={nodeId}
        nodeName={nodeName}
        onBack={() => setSubscreen("list")}
        onSaved={() => {
          setSubscreen("list");
          reload();
        }}
      />
    );
  }

  if (subscreen === "image-edit" && selectedAssignment) {
    return (
      <NodeImageAssignmentForm
        mode="edit"
        clusterId={clusterId}
        clusterName={clusterName}
        nodeId={nodeId}
        nodeName={nodeName}
        assignment={selectedAssignment}
        onBack={() => setSubscreen("list")}
        onSaved={() => {
          setSubscreen("list");
          reload();
        }}
      />
    );
  }

  if (subscreen === "image-confirm-delete" && selectedAssignment) {
    return (
      <ConfirmDeleteScreen
        title="unassign image"
        itemId={selectedAssignment.imageName}
        entityLabel="image assignment"
        onDelete={() =>
          clusterApi.imagesUnassign({
            sessionId,
            clusterId,
            nodeId,
            imageId: selectedAssignment.imageId,
          })}
        onConfirmed={() => {
          setSubscreen("list");
          reload();
        }}
        onBack={() => setSubscreen("list")}
      />
    );
  }

  const hasVirtualMachines = virtualMachines.length > 0;
  const hasImages = assignments.length > 0;

  const tabHelp = activeTab === "virtualMachines"
    ? (nodeBusy
      ? (hasVirtualMachines
        ? `↵ open   (node ${nodeState} — read-only)`
        : `(node ${nodeState} — read-only)`)
      : (hasVirtualMachines
        ? "↵ open   r register   e edit   u unregister   x unregister all"
        : "r register"))
    : (hasImages ? "r assign   e edit   u unassign" : "r assign");

  const footer = <HelpBar>{[tabHelp, "←→ tabs", "esc back"].join("   ")}</HelpBar>;

  // Same pattern as the cluster-detail nodes legend — chalk-coloured strings
  // inside a single Text so Box layout doesn't eat the spacing.
  const legend = primaryConnection && activeTab === "virtualMachines"
    ? (
      <Text>
        {" "}
        {chalk.green("● running")} {chalk.red("● stopped")} {dimText("● not found")}
        {" "}
      </Text>
    )
    : undefined;
  // Visible chars: " ● running   ● stopped   ● not found " = 37
  const legendWidth = legend ? 37 : 0;

  const tabBar = (
    <TabBar
      items={[
        { id: "virtualMachines", label: "virtual machines" },
        { id: "images", label: "OS images" },
      ]}
      currentId={activeTab}
    />
  );

  return (
    <ScreenFrame
      breadcrumb={["topologies", clusterName, nodeName]}
      header={tabBar}
      bottomRight={legend}
      bottomRightWidth={legendWidth}
      footer={footer}
    >
      {activeTab === "virtualMachines" && notice && <Text>{chalk.yellow(`⚠ ${notice}`)}</Text>}
      {activeTab === "virtualMachines" && (
        <VirtualMachinesTab
          virtualMachines={virtualMachines}
          cursor={vmCursor}
          setCursor={setVirtualMachineCursor}
          onSubscreen={requestVirtualMachineSubscreen}
        />
      )}
      {activeTab === "images" && (
        <ImagesTab
          assignments={assignments}
          cursor={imageCursor}
          setCursor={setImageCursor}
          onSubscreen={setSubscreen}
        />
      )}
    </ScreenFrame>
  );
}

type VirtualMachinesTabProps = {
  virtualMachines: readonly ProxmoxVirtualMachineRecord[];
  cursor: number;
  setCursor: (c: number) => void;
  onSubscreen: (s: Subscreen) => void;
};

function VirtualMachinesTab(
  { virtualMachines, cursor, setCursor, onSubscreen }: VirtualMachinesTabProps,
) {
  useInput((input, key) => {
    if (key.ctrl || key.meta) return;
    if (input === "r") {
      onSubscreen("vm-new");
      return;
    }
    if (virtualMachines.length === 0) return;
    if (key.return) {
      onSubscreen("vm-detail");
      return;
    }
    if (input === "e") {
      onSubscreen("vm-edit");
      return;
    }
    if (input === "u") {
      onSubscreen("vm-confirm-delete");
      return;
    }
    if (input === "x") {
      onSubscreen("vm-confirm-delete-all");
      return;
    }
    if (key.upArrow) setCursor(Math.max(0, cursor - 1));
    if (key.downArrow) setCursor(Math.min(virtualMachines.length - 1, cursor + 1));
  });

  const rows = virtualMachines.map((vm) => {
    const r = vm.resources;
    const tone = r.live?.status === "running"
      ? "ok"
      : r.live?.status === "stopped"
      ? "danger"
      : "muted";
    const storageSuffix = vm.storage ? ` (${vm.storage})` : "";
    const cpu = r.live
      ? labeledBar(
        r.live.cpuPercent,
        `${r.live.cpuPercent}% of ${String(r.live.cpuCores).padStart(2)} CPU(s)`,
      )
      : (r.local.cpu > 0 ? emptyBar(`${r.local.cpu} CPU(s)`) : emptyBar("—"));
    const ram = r.live
      ? labeledBar(
        pct(r.live.ramUsedGiB, r.live.ramTotalGiB),
        `${pct(r.live.ramUsedGiB, r.live.ramTotalGiB)}% ${formatGiB(r.live.ramUsedGiB)}/${
          formatGiB(r.live.ramTotalGiB)
        }`,
      )
      : (r.local.ram > 0 ? emptyBar(`${Number((r.local.ram / 1024).toFixed(2))}`) : emptyBar("—"));
    // Proxmox/cluster-resources doesn't report VM filesystem usage (requires
    // qemu-guest-agent + a separate endpoint). Show total + storage only.
    const disk = r.live
      ? emptyBar(`${formatGiB(r.live.diskTotalGiB)}${storageSuffix}`)
      : (r.local.disk > 0 ? emptyBar(`${r.local.disk}${storageSuffix}`) : emptyBar("—"));
    return {
      "": statusDot(tone),
      name: vm.name,
      vmid: String(vm.id),
      tags: vm.tags.join(", ") || "—",
      ip: vm.ip,
      cpu,
      "ram (GiB)": ram,
      "disk (GiB)": disk,
      uptime: r.live ? formatUptime(r.live.uptimeSeconds) : "—",
    };
  });

  return (
    <Table
      rows={rows}
      columns={[
        { key: "", bright: true },
        { key: "name" },
        { key: "vmid", align: "right" },
        { key: "tags" },
        { key: "ip" },
        { key: "cpu" },
        { key: "ram (GiB)" },
        { key: "disk (GiB)" },
        { key: "uptime", align: "right" },
      ]}
      focusedIndex={virtualMachines.length > 0 ? cursor : undefined}
      emptyMessage="No virtual machines found. Press r to register one."
    />
  );
}

type ImagesTabProps = {
  assignments: NodeAssignment[];
  cursor: number;
  setCursor: (c: number) => void;
  onSubscreen: (s: Subscreen) => void;
};

function ImagesTab({ assignments, cursor, setCursor, onSubscreen }: ImagesTabProps) {
  useInput((input, key) => {
    if (key.ctrl || key.meta) return;
    if (input === "r") {
      onSubscreen("image-new");
      return;
    }
    if (assignments.length === 0) return;
    if (input === "e") {
      onSubscreen("image-edit");
      return;
    }
    if (input === "u") {
      onSubscreen("image-confirm-delete");
      return;
    }
    if (key.upArrow) setCursor(Math.max(0, cursor - 1));
    if (key.downArrow) setCursor(Math.min(assignments.length - 1, cursor + 1));
  });

  const rows = assignments.map((a) => ({
    name: a.imageName,
    vmid: String(a.virtualMachineId),
    storage: a.storage,
  }));

  return (
    <Table
      rows={rows}
      columns={[
        { key: "name" },
        { key: "vmid", align: "right" },
        { key: "storage" },
      ]}
      focusedIndex={assignments.length > 0 ? cursor : undefined}
      emptyMessage="No images assigned to this node. Press r to assign one."
    />
  );
}
