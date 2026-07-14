/// <reference types="@types/react" />
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import chalk from "chalk";
import type { ProvisionRecord } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import {
  dotsSpinner,
  ScrollView,
  type ScrollViewRef,
  Spinner,
  Task,
  TaskList,
  TextInput,
} from "@ui/shared/design-system/mod.ts";
import {
  abortRun,
  type Phase,
  type ProvisioningDeps,
  type RequiredImage,
  type RunAction,
  setCancelConfirming,
  setPendingConfirm,
  setPhase,
  setSelected,
  startApply,
  startDestroy,
  startPlan,
  useRunState,
} from "@ui/cluster/providers/proxmox/provisioning-store.ts";
import { useCluster, useClusterEvents, useOperations } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { DimText, useTheme } from "@ui/shared/theme/mod.ts";

type Props = {
  active: boolean;
  clusterId: string;
  clusterName: string;
  hasConnection: boolean;
  onBack: () => void;
};

export function ProvisioningTab({ active, clusterId, hasConnection, onBack }: Props) {
  const [topology, setTopology] = useState<ProvisionRecord | null>(null);
  const [nodeCursor, setNodeCursor] = useState(0);
  const [cancelInput, setCancelInput] = useState("");
  const [confirmInput, setConfirmInput] = useState("");

  const sessionId = useSessionId();
  const cluster = useCluster();
  const clusterEvents = useClusterEvents();
  const operations = useOperations();
  const deps: ProvisioningDeps = { sessionId, cluster, clusterEvents, operations };

  const runState = useRunState(clusterId);
  const {
    phase,
    runAction,
    aborting,
    cancelConfirming,
    pendingConfirm,
    log,
    error,
    completedTasks,
    selected,
  } = runState;

  const logScrollRef = useRef<ScrollViewRef>(null);
  const logOffsetRef = useRef(0);
  const followingRef = useRef(true);

  // Helper to scroll the log without overshooting the bottom of the content,
  // and to keep `followingRef` in sync with explicit user intent. Inferring
  // follow from `onScroll` was unreliable: ScrollView fires onScroll during
  // mount/reflow with stale offsets, which would silently break the auto-
  // scroll that brings the operator back to the latest log line.
  const scrollLog = (delta: number) => {
    const ref = logScrollRef.current;
    if (!ref) return;
    const max = ref.getBottomOffset?.() ?? 0;
    const next = Math.max(0, Math.min(max, logOffsetRef.current + delta));
    ref.scrollTo(next);
    followingRef.current = next >= max;
  };

  const { stdout } = useStdout();
  const [rows, setRows] = useState(stdout.rows ?? 30);
  useEffect(() => {
    const onResize = () => setRows(stdout.rows ?? 30);
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);
  // Heuristic only — used to decide when the tree cursor needs auto-scrolling.
  // The real viewport height is decided by Yoga at render time (flexGrow).
  const treeViewportEstimate = Math.max(10, rows - 14);

  const treeScrollRef = useRef<ScrollViewRef>(null);
  const treeOffsetRef = useRef(0);

  const reload = useCallback(async () => {
    const fetched = await cluster.provision({ sessionId, clusterId });
    const record: ProvisionRecord = {
      ...fetched,
      nodes: [...fetched.nodes].sort((a, b) => a.name.localeCompare(b.name)),
    };
    setTopology(record);
    // Auto-select hasCredential nodes only on first load (store empty + idle).
    if (selected.size === 0 && phase === "idle") {
      setSelected(
        clusterId,
        new Set(record.nodes.filter((n) => n.hasCredential).map((n) => n.id)),
      );
    }
  }, [cluster, sessionId, clusterId, selected.size, phase]);

  useEffect(() => {
    if (!hasConnection) {
      setTopology(null);
      return;
    }
    reload();
  }, [reload, hasConnection]);

  const requiredImages = useCallback((): RequiredImage[] => {
    if (!topology) return [];
    const ids = Array.from(selected);
    const referenced = new Set<string>();
    for (const node of topology.nodes) {
      if (!ids.includes(node.id)) continue;
      for (const vm of node.virtualMachines) referenced.add(vm.image);
    }
    return topology.images
      .filter((t) => ids.includes(t.nodeId) && referenced.has(t.id))
      .map((t) => ({
        nodeId: t.nodeId,
        nodeName: t.nodeName,
        imageId: t.id,
        imageName: t.name,
      }));
  }, [topology, selected]);

  // Compute node heights (for tree auto-scroll)
  const nodeHeights = topology
    ? topology.nodes.map((node) => {
      const vmLines = node.virtualMachines.length;
      const noVirtualMachineFallback = node.virtualMachines.length === 0 ? 1 : 0;
      return 1 + vmLines + noVirtualMachineFallback + 1;
    })
    : [];
  const nodeOffsets: number[] = [];
  {
    let acc = 0;
    for (const h of nodeHeights) {
      nodeOffsets.push(acc);
      acc += h;
    }
  }
  const treeContentHeight = nodeHeights.reduce((s, h) => s + h, 0);
  const treeNeedsScroll = treeContentHeight > treeViewportEstimate;

  useEffect(() => {
    if (phase !== "idle" || !treeScrollRef.current || !topology || !treeNeedsScroll) return;
    if (nodeCursor < 0 || nodeCursor >= topology.nodes.length) return;
    const start = nodeOffsets[nodeCursor] ?? 0;
    const end = start + (nodeHeights[nodeCursor] ?? 1);
    const current = treeOffsetRef.current;
    if (start < current) {
      treeScrollRef.current.scrollTo(start);
    } else if (end > current + treeViewportEstimate) {
      treeScrollRef.current.scrollTo(Math.max(0, end - treeViewportEstimate));
    }
  }, [nodeCursor, phase, topology, treeViewportEstimate, treeNeedsScroll]);

  useInput((input, key) => {
    if (!hasConnection || !topology) {
      if (key.escape) onBack();
      return;
    }

    if (phase === "running") {
      if (cancelConfirming) {
        // TextInput owns keystrokes while the cancel prompt is open.
        return;
      }
      if (key.escape) {
        // Leave the screen without cancelling — the run keeps going
        // server-side and is still tracked (useAnyRunning); coming back
        // resumes the live view. A hung/slow run must never trap the UI.
        onBack();
        return;
      }
      if (input === "c" && !aborting) {
        setCancelConfirming(clusterId, true);
        setCancelInput("");
        return;
      }
      if (key.upArrow) scrollLog(-1);
      else if (key.downArrow) scrollLog(1);
      else if (key.pageUp) scrollLog(-6);
      else if (key.pageDown) scrollLog(6);
      return;
    }

    if (phase === "done" || phase === "error") {
      if (pendingConfirm) {
        // TextInput owns keystrokes while the inline confirm prompt is open.
        return;
      }
      if (key.escape) {
        setPhase(clusterId, "idle");
        return;
      }
      // After a successful plan, jump straight into apply via "a" or ↵.
      if (phase === "done" && runAction === "plan") {
        if (input === "a" || key.return) {
          setPendingConfirm(clusterId, "apply");
          setConfirmInput("");
          return;
        }
      } else if (key.return) {
        // After apply/destroy/error, ↵ acknowledges the result and returns
        // to the topology tree (idle).
        setPhase(clusterId, "idle");
        return;
      }
      if (key.upArrow) scrollLog(-1);
      else if (key.downArrow) scrollLog(1);
      else if (key.pageUp) scrollLog(-6);
      else if (key.pageDown) scrollLog(6);
      return;
    }

    // idle
    if (pendingConfirm) {
      // TextInput owns keystrokes while the confirm prompt is open.
      return;
    }
    if (key.escape) {
      onBack();
      return;
    }
    const nodes = topology.nodes;
    if (nodes.length === 0) return;
    if (key.upArrow) {
      setNodeCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (key.downArrow) {
      setNodeCursor((c) => Math.min(nodes.length - 1, c + 1));
      return;
    }
    if (input === " ") {
      const node = nodes[nodeCursor];
      if (!node || !node.hasCredential) return;
      const next = new Set(selected);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      setSelected(clusterId, next);
      return;
    }
    if (input === "A") {
      setSelected(
        clusterId,
        new Set(nodes.filter((n) => n.hasCredential).map((n) => n.id)),
      );
      return;
    }
    if (input === "N") {
      setSelected(clusterId, new Set());
      return;
    }
    if (selected.size === 0) return;
    if (input === "p") {
      setPendingConfirm(clusterId, "plan");
      setConfirmInput("");
      return;
    }
    if (input === "a") {
      setPendingConfirm(clusterId, "apply");
      setConfirmInput("");
      return;
    }
    if (input === "d") {
      setPendingConfirm(clusterId, "destroy");
      setConfirmInput("");
      return;
    }
  }, { isActive: active });

  // Cancel-prompt: only escape is handled here; TextInput owns typing/submit.
  useInput((_char, key) => {
    if (key.escape) {
      setCancelConfirming(clusterId, false);
      setCancelInput("");
    }
  }, { isActive: active && phase === "running" && cancelConfirming });

  const submitCancel = (value: string) => {
    if (value.trim() === "cancel") {
      setCancelConfirming(clusterId, false);
      setCancelInput("");
      void abortRun(deps, clusterId);
    }
  };

  // Confirm-prompt (plan / apply / destroy): same shape as cancel. Active in
  // both idle (initial action selection) and done-plan (apply right after a
  // successful plan, keeping the log on screen).
  useInput((_char, key) => {
    if (key.escape) {
      setPendingConfirm(clusterId, null);
      setConfirmInput("");
    }
  }, {
    isActive: active && pendingConfirm !== null &&
      (phase === "idle" || phase === "done" || phase === "error"),
  });

  const submitConfirm = (value: string) => {
    if (value.trim() !== pendingConfirm) return;
    const action = pendingConfirm;
    setPendingConfirm(clusterId, null);
    setConfirmInput("");
    if (action === "plan") void startPlan(deps, clusterId, Array.from(selected));
    else if (action === "apply") {
      void startApply(deps, clusterId, Array.from(selected), requiredImages());
    } else if (action === "destroy") void startDestroy(deps, clusterId, Array.from(selected));
  };

  if (!active) return null;

  if (!hasConnection) {
    return <DimText>○ no provider connected — connect a provider to enable provisioning.</DimText>;
  }
  if (!topology) {
    return <Spinner label="loading topology..." />;
  }

  const selectedNames = topology.nodes.filter((n) => selected.has(n.id)).map((n) => n.name);
  const target = selectedNames.length === 0
    ? "selected nodes"
    : selectedNames.length <= 3
    ? selectedNames.join(", ")
    : `${selectedNames.length} nodes`;

  const confirmIntent: "yellow" | "red" = pendingConfirm === "destroy" ? "red" : "yellow";
  const confirmQuestion = pendingConfirm === "plan"
    ? `Run plan on ${target}?`
    : pendingConfirm === "apply"
    ? `Apply provisioning changes on ${target}?`
    : pendingConfirm === "destroy"
    ? `Destroy VMs on ${target}?`
    : "";
  const tmplCount = pendingConfirm === "apply" ? requiredImages().length : 0;

  if (phase === "running" || phase === "done" || phase === "error") {
    return (
      <RunView
        topology={topology}
        selected={selected}
        phase={phase}
        runAction={runAction}
        aborting={aborting}
        completedTasks={completedTasks}
        error={error}
        log={log}
        scrollRef={logScrollRef}
        offsetRef={logOffsetRef}
        followingRef={followingRef}
        cancelConfirming={cancelConfirming}
        cancelInput={cancelInput}
        onCancelInputChange={setCancelInput}
        onCancelSubmit={submitCancel}
        pendingConfirm={pendingConfirm}
        confirmQuestion={confirmQuestion}
        confirmIntent={confirmIntent}
        confirmTmplCount={tmplCount}
        confirmInput={confirmInput}
        onConfirmInputChange={setConfirmInput}
        onConfirmSubmit={submitConfirm}
      />
    );
  }

  // idle
  const tree = <NodesTree topology={topology} cursor={nodeCursor} selected={selected} />;

  return (
    <Box flexDirection="column" flexGrow={1} minHeight={0}>
      {/* Tree zone grows to consume free space, pushing the prompt to the bottom. */}
      <Box flexGrow={1} flexShrink={1} minHeight={0} flexDirection="column">
        {treeNeedsScroll
          ? (
            <ScrollView
              ref={treeScrollRef}
              flexGrow={1}
              flexShrink={1}
              minHeight={0}
              onScroll={(offset) => {
                treeOffsetRef.current = offset;
              }}
            >
              {tree}
            </ScrollView>
          )
          : tree}
      </Box>

      {pendingConfirm && (
        <ConfirmPrompt
          action={pendingConfirm}
          question={confirmQuestion}
          intent={confirmIntent}
          tmplCount={tmplCount}
          value={confirmInput}
          onChange={setConfirmInput}
          onSubmit={submitConfirm}
        />
      )}
    </Box>
  );
}

function ConfirmPrompt(
  { action, question, intent, tmplCount, value, onChange, onSubmit }: {
    action: RunAction;
    question: string;
    intent: "yellow" | "red";
    tmplCount: number;
    value: string;
    onChange: (v: string) => void;
    onSubmit: (v: string) => void;
  },
) {
  return (
    <Box flexDirection="column" flexShrink={0} marginTop={1}>
      <Text color={intent}>{question}</Text>
      <Text>Type {action} to confirm:</Text>
      {action === "destroy" && (
        <Text color="red">This action is irreversible — VMs will be permanently removed.</Text>
      )}
      {tmplCount > 0 && <DimText>{tmplCount} image(s) will be created first if missing.</DimText>}
      <Box gap={1}>
        <Text color={intent}>❯</Text>
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder={action}
          focus
        />
      </Box>
    </Box>
  );
}

type NodeWidths = {
  nodeName: number;
  vmName: number;
  virtualMachineId: number;
  vmIp: number;
  image: number;
};

function templateLabel(vm: { image: string; imageName: string }): string {
  if (vm.imageName === vm.image) return "—";
  return vm.imageName;
}

function computeWidths(nodes: ProvisionRecord["nodes"]): NodeWidths {
  let nodeName = 0, vmName = 0, virtualMachineId = 0, vmIp = 0, image = 0;
  for (const n of nodes) {
    if (n.name.length > nodeName) nodeName = n.name.length;
    for (const vm of n.virtualMachines) {
      if (vm.name.length > vmName) vmName = vm.name.length;
      const idStr = String(vm.id);
      if (idStr.length > virtualMachineId) virtualMachineId = idStr.length;
      if (vm.ip.length > vmIp) vmIp = vm.ip.length;
      const label = templateLabel(vm);
      if (label.length > image) image = label.length;
    }
  }
  return { nodeName, vmName, virtualMachineId, vmIp, image };
}

function NodesTree(
  { topology, cursor, selected }: {
    topology: ProvisionRecord;
    cursor: number;
    selected: Set<string>;
  },
) {
  const theme = useTheme();
  if (topology.nodes.length === 0) return <DimText>No nodes registered.</DimText>;
  const widths = computeWidths(topology.nodes);
  return (
    <Box flexDirection="column">
      {topology.nodes.map((node, i) => {
        const focused = i === cursor;
        const checked = selected.has(node.id);
        const disabled = !node.hasCredential;
        const box = disabled ? "◌" : checked ? "◉" : "○";
        return (
          <Box key={node.id} flexDirection="column" marginBottom={1}>
            <Box gap={1}>
              <Text color={focused ? "cyan" : undefined}>{focused ? "❯" : " "}</Text>
              <Text color={disabled ? theme.dim : checked ? "green" : undefined}>{box}</Text>
              <Text bold color={disabled ? theme.dim : undefined}>
                {node.name.padEnd(widths.nodeName)}
              </Text>
              <DimText>{node.ip}</DimText>
              {disabled && <Text color="red">(no credential)</Text>}
            </Box>
            {node.virtualMachines.length === 0
              ? <DimText>no virtual machines</DimText>
              : (
                <Box flexDirection="column" marginLeft={4}>
                  {node.virtualMachines.map((vm) => {
                    const line = `  • ${vm.name.padEnd(widths.vmName)} (${
                      String(vm.id).padStart(widths.virtualMachineId)
                    }) ${vm.ip.padEnd(widths.vmIp)} · ${
                      templateLabel(vm).padEnd(widths.image)
                    } · ${vm.cpu}c/${vm.ram}MB/${vm.disk}GB`;
                    return <DimText key={vm.id}>{line}</DimText>;
                  })}
                </Box>
              )}
          </Box>
        );
      })}
    </Box>
  );
}

function RunView(
  {
    topology,
    selected,
    phase,
    runAction,
    aborting,
    completedTasks,
    error,
    log,
    scrollRef,
    offsetRef,
    followingRef,
    cancelConfirming,
    cancelInput,
    onCancelInputChange,
    onCancelSubmit,
    pendingConfirm,
    confirmQuestion,
    confirmIntent,
    confirmTmplCount,
    confirmInput,
    onConfirmInputChange,
    onConfirmSubmit,
  }: {
    topology: ProvisionRecord;
    selected: Set<string>;
    phase: Phase;
    runAction: RunAction | null;
    aborting: boolean;
    completedTasks: Set<string>;
    error: string;
    log: string[];
    scrollRef: React.RefObject<ScrollViewRef>;
    offsetRef: React.MutableRefObject<number>;
    followingRef: React.MutableRefObject<boolean>;
    cancelConfirming: boolean;
    cancelInput: string;
    onCancelInputChange: (value: string) => void;
    onCancelSubmit: (value: string) => void;
    pendingConfirm: RunAction | null;
    confirmQuestion: string;
    confirmIntent: "yellow" | "red";
    confirmTmplCount: number;
    confirmInput: string;
    onConfirmInputChange: (v: string) => void;
    onConfirmSubmit: (v: string) => void;
  },
) {
  return (
    <Box flexDirection="column" gap={1} flexGrow={1} minHeight={0}>
      <TaskList>
        {topology.nodes
          .filter((n) => selected.has(n.id))
          .map((n) => {
            // Provisioning runs per node (no environment grouping),
            // so one task row per node, keyed by node name.
            const completedKey = n.name;
            const done = completedTasks.has(n.id);
            let state: "pending" | "loading" | "success" | "warning" | "error";
            if (done) state = "success";
            else if (phase === "running") state = "loading";
            else if (phase === "error") state = "error";
            else state = "warning";
            const baseLabel = n.name;
            const progressVerb: Record<RunAction, string> = {
              plan: "planning",
              apply: "applying",
              destroy: "destroying",
            };
            const suffix = phase === "running" && runAction
              ? ` — ${aborting ? "aborting" : progressVerb[runAction]}`
              : phase === "done" && runAction
              ? ` — ${runAction.charAt(0).toUpperCase() + runAction.slice(1)} completed`
              : "";
            const plainLabel = `${baseLabel}${suffix}`;
            // Task only takes a string label, so we color-tint the label by
            // injecting ANSI escapes via chalk — matches the state's icon.
            const label = state === "success"
              ? chalk.green(plainLabel)
              : state === "error"
              ? chalk.red(plainLabel)
              : state === "warning"
              ? chalk.yellow(plainLabel)
              : plainLabel;
            return state === "loading"
              ? (
                <Task
                  key={completedKey}
                  label={label}
                  state={state}
                  spinner={dotsSpinner}
                />
              )
              : <Task key={completedKey} label={label} state={state} />;
          })}
      </TaskList>

      {
        /*
        Per-node create/update/delete summary previously rendered from
        NodePlanned/NodeApplied/NodeDestroySucceeded stream events. Those left the
        generic execution stream (schema-canonical Log/Step/Succeeded/
        Failed/Cancelled). A richer summary sourced from cluster domain events via
        cluster.subscribe is planned — until then the per-node counts live only in
        the streamed Log lines above.
      */
      }

      {phase === "error" && <Text color="red">✗ {summarizeError(error)}</Text>}

      <LogPanel
        log={log}
        phase={phase}
        runAction={runAction}
        aborting={aborting}
        cancelConfirming={cancelConfirming}
        pendingConfirm={pendingConfirm}
        scrollRef={scrollRef}
        offsetRef={offsetRef}
        followingRef={followingRef}
      />

      {cancelConfirming && (
        <Box flexDirection="column" flexShrink={0}>
          <Text color="yellow">Type cancel to interrupt the run:</Text>
          <Box gap={1}>
            <Text color="yellow">❯</Text>
            <TextInput
              value={cancelInput}
              onChange={onCancelInputChange}
              onSubmit={onCancelSubmit}
              placeholder="cancel"
              focus
            />
          </Box>
        </Box>
      )}

      {pendingConfirm && (
        <ConfirmPrompt
          action={pendingConfirm}
          question={confirmQuestion}
          intent={confirmIntent}
          tmplCount={confirmTmplCount}
          value={confirmInput}
          onChange={onConfirmInputChange}
          onSubmit={onConfirmSubmit}
        />
      )}
    </Box>
  );
}

function LogPanel({
  log,
  phase,
  runAction,
  aborting,
  cancelConfirming,
  pendingConfirm,
  scrollRef,
  offsetRef,
  followingRef,
}: {
  log: string[];
  phase: Phase;
  runAction: RunAction | null;
  aborting: boolean;
  cancelConfirming: boolean;
  pendingConfirm: RunAction | null;
  scrollRef: React.RefObject<ScrollViewRef>;
  offsetRef: React.MutableRefObject<number>;
  followingRef: React.MutableRefObject<boolean>;
}) {
  // ink-scroll-view computes bottom from a cached content-height ref. We
  // sync to the bottom inside `useLayoutEffect` (synchronously, before Ink
  // commits the frame to stdout) so the user never sees an intermediate
  // frame at the top of the log. Earlier attempts used `setTimeout` and
  // produced a visible bounce — the first frame painted at the top, then
  // a tick later the scroll jumped to the bottom forcing a Yoga relayout
  // that propagated up to the cluster screen header.
  const stickToBottom = () => {
    if (!followingRef.current) return;
    scrollRef.current?.remeasure();
    scrollRef.current?.scrollToBottom();
  };

  useLayoutEffect(() => {
    followingRef.current = true;
    stickToBottom();
  }, []);

  // Phase / runAction / aborting transitions reflow the chrome above the log
  // (spinner appearing or going away, label suffix flipping). Re-stick in
  // the same commit so the operator never sees a stale offset.
  useLayoutEffect(() => {
    stickToBottom();
  }, [phase, runAction, aborting, cancelConfirming, pendingConfirm]);

  return (
    <Box flexDirection="column" flexGrow={1} minHeight={0}>
      <DimText>
        {log.length === 0
          ? "waiting for output..."
          : `${log.length} lines${followingRef.current ? " (follow)" : ""}`}
      </DimText>
      <ScrollView
        ref={scrollRef}
        flexGrow={1}
        flexShrink={1}
        minHeight={0}
        onScroll={(offset) => {
          offsetRef.current = offset;
        }}
        onContentHeightChange={stickToBottom}
      >
        {log.map((line, i) => <Text key={i} wrap="truncate-end">{line}</Text>)}
      </ScrollView>
    </Box>
  );
}

function summarizeError(msg: string): string {
  const lines = msg.split("\n").map((l) => l.trim()).filter(Boolean);
  const significant = lines.find((l) => !/^[╷╵│]/.test(l)) ?? lines[0] ?? "";
  const clean = significant.replace(/^│\s*/, "").replace(/^Error:\s*/i, "");
  return clean.length > 140 ? clean.slice(0, 140) + "..." : clean;
}
