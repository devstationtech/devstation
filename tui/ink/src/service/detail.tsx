/// <reference types="@types/react" />
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { StationServiceRecord } from "@jsonrpc-contracts-ts/station.gen.ts";
import { useOperations, useStation } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import {
  ScreenFrame,
  ScrollView,
  type ScrollViewRef,
  Spinner,
  statusDot,
  Table,
  Tabs,
  TextInput,
} from "@ui/shared/design-system/mod.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

type Phase = "idle" | "installing" | "done" | "error" | "aborted";

type Props = {
  serviceId: string;
  onBack: () => void;
};

const MAX_LOG_LINES = 500;
const CONFIRM_TOKEN = "install";
const CANCEL_TOKEN = "cancel";

export function ServiceDetailScreen({ serviceId, onBack }: Props) {
  const stationApi = useStation();
  const operations = useOperations();
  const sessionId = useSessionId();
  const [service, setService] = useState<StationServiceRecord | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const [aborting, setAborting] = useState(false);

  const [confirming, setConfirming] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [confirmError, setConfirmError] = useState("");

  const [cancelConfirming, setCancelConfirming] = useState(false);
  const [cancelInput, setCancelInput] = useState("");

  // Log scroll state — mirrors provisioning-tab's pattern. `followingRef`
  // tracks whether new lines should auto-stick to the bottom; explicit user
  // scroll-up flips it off. `offsetRef` keeps the last scroll offset so
  // arrow keys can compute the next position without re-reading from ink.
  const logScrollRef = useRef<ScrollViewRef>(null);
  const logOffsetRef = useRef(0);
  const followingRef = useRef(true);

  const reload = useCallback(async () => {
    const r = await stationApi.servicesById({ sessionId, id: serviceId });
    setService(r);
  }, [stationApi, sessionId, serviceId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const startInstall = useCallback(async () => {
    if (phase === "installing") return;
    setPhase("installing");
    setLog([]);
    setError("");
    setAborting(false);
    followingRef.current = true;
    try {
      if (!service) throw new Error("service record not loaded");
      const { executionId } = await stationApi.install({
        sessionId,
        stationId: service.stationId,
        serviceIds: [serviceId],
      });
      setRunId(executionId);
      const stream = operations.watch({ sessionId, executionId });
      let terminal: Phase | null = null;
      let terminalError = "";
      for await (const output of stream) {
        if (output.type === "log") {
          setLog((prev) => {
            const next = [...prev, output.line];
            return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next;
          });
        } else if (output.type === "succeeded") {
          terminal = "done";
          break;
        } else if (output.type === "failed") {
          terminal = "error";
          terminalError = output.error;
          break;
        } else if (output.type === "cancelled") {
          terminal = "aborted";
          break;
        }
      }
      setRunId(null);
      setAborting(false);
      setPhase(terminal ?? "error");
      setError(terminalError);
      await reload();
    } catch (err) {
      setPhase("error");
      setError((err as Error).message);
      setRunId(null);
      setAborting(false);
    }
  }, [phase, service, serviceId, reload, stationApi, operations, sessionId]);

  const submitCancel = (value: string) => {
    if (value.trim() !== CANCEL_TOKEN) return;
    setCancelConfirming(false);
    setCancelInput("");
    void abortNow();
  };

  const abortNow = async () => {
    if (!runId || aborting) return;
    setAborting(true);
    setLog((prev) => [...prev, "▼ aborting run…"]);
    try {
      await operations.cancel({ sessionId, executionId: runId });
    } catch (err) {
      setLog((prev) => [...prev, `✗ abort failed: ${(err as Error).message}`]);
      setAborting(false);
    }
  };

  // Helper to scroll the log without overshooting and to keep the follow flag
  // in sync with explicit user intent (mirrors provisioning-tab).
  const scrollLog = (delta: number) => {
    const ref = logScrollRef.current;
    if (!ref) return;
    const max = ref.getBottomOffset?.() ?? 0;
    const next = Math.max(0, Math.min(max, logOffsetRef.current + delta));
    ref.scrollTo(next);
    followingRef.current = next >= max;
  };

  // Main key dispatcher.
  useInput((input, key) => {
    // Running.
    if (phase === "installing") {
      if (cancelConfirming) return; // TextInput owns it
      if (input === "c" && !aborting) {
        setCancelConfirming(true);
        setCancelInput("");
        return;
      }
      if (key.upArrow) scrollLog(-1);
      else if (key.downArrow) scrollLog(1);
      else if (key.pageUp) scrollLog(-6);
      else if (key.pageDown) scrollLog(6);
      return;
    }

    // Terminal phases (done / error / aborted) — ↵ or esc returns to detail.
    if (phase === "done" || phase === "error" || phase === "aborted") {
      if (key.return || key.escape) {
        setPhase("idle");
        setLog([]);
        setError("");
        return;
      }
      if (key.upArrow) scrollLog(-1);
      else if (key.downArrow) scrollLog(1);
      else if (key.pageUp) scrollLog(-6);
      else if (key.pageDown) scrollLog(6);
      return;
    }

    // Confirm prompt open — TextInput owns it; only esc cancels.
    if (confirming) {
      if (key.escape) {
        setConfirming(false);
        setConfirmInput("");
        setConfirmError("");
      }
      return;
    }

    // Idle.
    if (key.escape) {
      onBack();
      return;
    }
    if (input === "i" && service && service.status !== "INSTALLING") {
      setConfirming(true);
      setConfirmInput("");
      setConfirmError("");
    }
  });

  const handleConfirmSubmit = (value: string) => {
    if (value.trim().toLowerCase() === CONFIRM_TOKEN) {
      setConfirming(false);
      setConfirmInput("");
      setConfirmError("");
      startInstall();
    } else {
      setConfirmError(`type '${CONFIRM_TOKEN}' to confirm`);
      setConfirmInput("");
    }
  };

  if (!service) {
    return (
      <ScreenFrame
        breadcrumb={["topologies", "services", serviceId]}
        footer={<HelpBar>esc back</HelpBar>}
      >
        <Spinner label="loading service..." />
      </ScreenFrame>
    );
  }

  const tone = service.status === "INSTALLED"
    ? "ok"
    : service.status === "FAILED"
    ? "danger"
    : service.status === "INSTALLING"
    ? "warn"
    : "muted";

  const topologyLine = service.host
    ? `hosted → ${service.host.serviceName}.${service.host.role}`
    : `${service.instances.length} instance${service.instances.length === 1 ? "" : "s"}`;

  const summaryLine = (
    <Box gap={2}>
      <Text>
        {statusDot(tone)} <Text bold>{service.name}</Text>
      </Text>
      <DimText>blueprint {service.blueprint}</DimText>
      <DimText>{service.status}</DimText>
      <DimText>{topologyLine}</DimText>
      {service.lastInstalledAt && (
        <DimText>last install {service.lastInstalledAt.slice(0, 19).replace("T", " ")}</DimText>
      )}
    </Box>
  );

  const helpText = phase === "installing"
    ? cancelConfirming
      ? "↵ confirm   esc back"
      : aborting
      ? "↑↓ scroll   PgUp/PgDn page"
      : "c cancel   ↑↓ scroll   PgUp/PgDn page"
    : phase === "done" || phase === "error" || phase === "aborted"
    ? "↵/esc back   ↑↓ scroll   PgUp/PgDn page"
    : confirming
    ? "↵ confirm   esc cancel"
    : service.status === "INSTALLING"
    ? "←/→ tabs   esc back"
    : "i install   ←/→ tabs   esc back";

  return (
    <ScreenFrame
      breadcrumb={["topologies", "services", service.name]}
      header={summaryLine}
      footer={<HelpBar>{helpText}</HelpBar>}
    >
      {phase === "installing" || phase === "done" || phase === "error" || phase === "aborted"
        ? (
          <RunBody
            phase={phase}
            log={log}
            error={error}
            aborting={aborting}
            cancelConfirming={cancelConfirming}
            cancelInput={cancelInput}
            onCancelInputChange={setCancelInput}
            onCancelSubmit={submitCancel}
            scrollRef={logScrollRef}
            offsetRef={logOffsetRef}
            followingRef={followingRef}
          />
        )
        : (
          <Box flexDirection="column" flexGrow={1} minHeight={0}>
            <Box flexGrow={1} flexShrink={1} minHeight={0} flexDirection="column">
              <DetailBody service={service} focused={!confirming} />
            </Box>
            {confirming && (
              <ConfirmPrompt
                serviceName={service.name}
                instanceCount={service.instances.length}
                value={confirmInput}
                onChange={setConfirmInput}
                onSubmit={handleConfirmSubmit}
                error={confirmError}
              />
            )}
          </Box>
        )}
    </ScreenFrame>
  );
}

function DetailBody({ service, focused }: { service: StationServiceRecord; focused: boolean }) {
  return (
    <Tabs
      isFocused={focused}
      tabs={[
        { id: "instances", label: "instances", render: () => <InstancesTab service={service} /> },
        { id: "installs", label: "installs", render: () => <InstallsTab service={service} /> },
      ]}
    />
  );
}

function InstancesTab({ service }: { service: StationServiceRecord }) {
  if (service.host) {
    return (
      <Box flexDirection="column">
        <Text>
          Runs on <Text bold>{service.host.serviceName}</Text>{" "}
          <DimText>
            (blueprint {service.host.serviceBlueprint || "?"} · role {service.host.role})
          </DimText>
        </Text>
        <DimText>
          The installer resolves the host's instances at install time.
        </DimText>
      </Box>
    );
  }
  const rows = service.instances.map((i) => ({
    role: i.role,
    name: i.name || "—",
    host: i.host,
    provider: i.provider || "—",
    location: i.cluster || i.node ? `${i.cluster}/${i.node}` : "—",
  }));
  return (
    <Table
      rows={rows}
      columns={[
        { key: "role" },
        { key: "name" },
        { key: "host" },
        { key: "provider" },
        { key: "location" },
      ]}
      emptyMessage="No instances."
    />
  );
}

function InstallsTab({ service }: { service: StationServiceRecord }) {
  // Collapse per-instance installation entries into one row per run, keyed by
  // shared `at` timestamp + stack version. A single install emits N entries
  // (one per instance) with the same `at` — we display as a single event.
  const runs = collapseInstalls(service.installations);
  if (runs.length === 0) {
    return <DimText>Not installed yet.</DimText>;
  }
  const rows = runs.map((r) => ({
    "installed at": r.at.slice(0, 19).replace("T", " "),
    "blueprint version": r.blueprintVersion,
    roles: r.roles.join(", "),
    instances: String(r.instanceCount),
  }));
  return (
    <Table
      rows={rows}
      columns={[
        { key: "installed at" },
        { key: "blueprint version" },
        { key: "roles" },
        { key: "instances", align: "right" },
      ]}
    />
  );
}

type InstallRun = {
  at: string;
  blueprintVersion: string;
  roles: string[];
  instanceCount: number;
};

function collapseInstalls(installations: StationServiceRecord["installations"]): InstallRun[] {
  const groups = new Map<string, InstallRun & { roleSet: Set<string> }>();
  for (const d of installations) {
    const key = `${d.at}|${d.blueprintVersion}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        at: d.at,
        blueprintVersion: d.blueprintVersion,
        roles: [],
        roleSet: new Set(),
        instanceCount: 0,
      };
      groups.set(key, group);
    }
    group.instanceCount += 1;
    if (!group.roleSet.has(d.role)) {
      group.roleSet.add(d.role);
      group.roles.push(d.role);
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map(({ at, blueprintVersion, roles, instanceCount }) => ({
      at,
      blueprintVersion,
      roles,
      instanceCount,
    }));
}

function ConfirmPrompt(
  { serviceName, instanceCount, value, onChange, onSubmit, error }: {
    serviceName: string;
    instanceCount: number;
    value: string;
    onChange: (v: string) => void;
    onSubmit: (v: string) => void;
    error: string;
  },
) {
  return (
    <Box flexDirection="column" flexShrink={0} marginTop={1}>
      <Text color="yellow">
        Install '{serviceName}' to {instanceCount} instance{instanceCount === 1 ? "" : "s"}?
      </Text>
      <Text>Type {CONFIRM_TOKEN} to confirm:</Text>
      {error && <Text color="red">{error}</Text>}
      <Box gap={1}>
        <Text color="yellow">❯</Text>
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder={CONFIRM_TOKEN}
          focus
        />
      </Box>
    </Box>
  );
}

function RunBody(
  {
    phase,
    log,
    error,
    aborting,
    cancelConfirming,
    cancelInput,
    onCancelInputChange,
    onCancelSubmit,
    scrollRef,
    offsetRef,
    followingRef,
  }: {
    phase: Phase;
    log: string[];
    error: string;
    aborting: boolean;
    cancelConfirming: boolean;
    cancelInput: string;
    onCancelInputChange: (v: string) => void;
    onCancelSubmit: (v: string) => void;
    scrollRef: React.RefObject<ScrollViewRef>;
    offsetRef: React.MutableRefObject<number>;
    followingRef: React.MutableRefObject<boolean>;
  },
) {
  return (
    <Box flexDirection="column" gap={1} flexGrow={1} minHeight={0}>
      <Box>
        {phase === "installing" && <Spinner label={aborting ? "aborting..." : "installing..."} />}
        {phase === "done" && <Text color="green">✓ install completed</Text>}
        {phase === "error" && <Text color="red">✗ install failed: {summarizeError(error)}</Text>}
        {phase === "aborted" && <Text color="yellow">⚠ install aborted</Text>}
      </Box>

      <LogPanel
        log={log}
        phase={phase}
        aborting={aborting}
        cancelConfirming={cancelConfirming}
        scrollRef={scrollRef}
        offsetRef={offsetRef}
        followingRef={followingRef}
      />

      {cancelConfirming && (
        <Box flexDirection="column" flexShrink={0}>
          <Text color="yellow">Type {CANCEL_TOKEN} to interrupt the install:</Text>
          <Box gap={1}>
            <Text color="yellow">❯</Text>
            <TextInput
              value={cancelInput}
              onChange={onCancelInputChange}
              onSubmit={onCancelSubmit}
              placeholder={CANCEL_TOKEN}
              focus
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}

function LogPanel({
  log,
  phase,
  aborting,
  cancelConfirming,
  scrollRef,
  offsetRef,
  followingRef,
}: {
  log: string[];
  phase: Phase;
  aborting: boolean;
  cancelConfirming: boolean;
  scrollRef: React.RefObject<ScrollViewRef>;
  offsetRef: React.MutableRefObject<number>;
  followingRef: React.MutableRefObject<boolean>;
}) {
  const stickToBottom = () => {
    if (!followingRef.current) return;
    scrollRef.current?.remeasure();
    scrollRef.current?.scrollToBottom();
  };

  useLayoutEffect(() => {
    followingRef.current = true;
    stickToBottom();
  }, []);

  useLayoutEffect(() => {
    stickToBottom();
  }, [phase, aborting, cancelConfirming]);

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
  const first = lines[0] ?? msg;
  return first.length > 140 ? first.slice(0, 140) + "..." : first;
}
