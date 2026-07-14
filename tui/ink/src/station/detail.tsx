/// <reference types="@types/react" />
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { StationRecord, StationServiceRecord } from "@jsonrpc-contracts-ts/station.gen.ts";
import { useOperations, useStation } from "@ui/rpc-clients-provider.tsx";
import { useSessionId } from "@ui/auth/session-provider.tsx";
import { ServiceDetailScreen } from "@ui/service/detail.tsx";
import { ServiceForm } from "@ui/service/form.tsx";
import { StationForm } from "@ui/station/form.tsx";
import { ConfirmDeleteScreen } from "@ui/shared/confirm-delete-screen.tsx";
import { HelpBar } from "@ui/shared/help-bar.tsx";
import {
  ScreenFrame,
  ScrollView,
  type ScrollViewRef,
  Spinner,
  statusDot,
  Table,
  TextInput,
} from "@ui/shared/design-system/mod.ts";
import { DimText } from "@ui/shared/theme/mod.ts";

type Phase = "idle" | "installing" | "done" | "error" | "aborted";
type View = "detail" | "service" | "register-service" | "edit";

const MAX_LOG_LINES = 500;
const CANCEL_TOKEN = "cancel";

type Props = {
  stationId: string;
  onBack: () => void;
};

export function StationDetailScreen({ stationId, onBack }: Props) {
  const stationApi = useStation();
  const operations = useOperations();
  const sessionId = useSessionId();
  const [station, setStation] = useState<StationRecord | null>(null);
  const [services, setServices] = useState<readonly StationServiceRecord[]>([]);
  const [view, setView] = useState<View>("detail");
  const [openServiceId, setOpenServiceId] = useState<string | null>(null);
  const [serviceCursor, setServiceCursor] = useState(0);

  const [phase, setPhase] = useState<Phase>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [aborting, setAborting] = useState(false);

  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<"install" | "uninstall">("install");

  const [confirming, setConfirming] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [confirmError, setConfirmError] = useState("");

  const [cancelConfirming, setCancelConfirming] = useState(false);
  const [cancelInput, setCancelInput] = useState("");

  // Removing (unregistering) a single service from the station — distinct from
  // uninstalling it (uninstall tears down the install; the record stays).
  const [removeTarget, setRemoveTarget] = useState<StationServiceRecord | null>(null);

  // Services rendered as a host→hosted tree: a standalone service is a root,
  // and services hosted on it nest one level in. Cursor navigation and the
  // multi-select picker index into THIS ordered list, so keyboard order
  // matches what's on screen.
  const ordered = useMemo(() => orderServiceTree(services), [services]);
  const serviceAt = (i: number): StationServiceRecord | undefined => ordered[i]?.service;

  const logScrollRef = useRef<ScrollViewRef>(null);
  const logOffsetRef = useRef(0);
  const followingRef = useRef(true);

  const reload = useCallback(async () => {
    const [s, list] = await Promise.all([
      stationApi.byId({ sessionId, id: stationId }),
      stationApi.servicesByStation({ sessionId, stationId }),
    ]);
    setStation(s);
    setServices(list);
  }, [stationApi, sessionId, stationId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const startInstall = useCallback(async (ids: string[], runAction: "install" | "uninstall") => {
    if (phase === "installing") return;
    if (ids.length === 0) {
      setError(`Select at least one service to ${runAction}.`);
      setPhase("error");
      return;
    }
    setPhase("installing");
    setLog([]);
    setError("");
    setAborting(false);
    followingRef.current = true;
    try {
      const { executionId } = await (runAction === "install"
        ? stationApi.install({ sessionId, stationId, serviceIds: ids })
        : stationApi.uninstall({ sessionId, stationId, serviceIds: ids }));
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
  }, [phase, stationId, reload, stationApi, operations, sessionId]);

  const submitCancel = (value: string) => {
    if (value.trim() !== CANCEL_TOKEN) return;
    setCancelConfirming(false);
    setCancelInput("");
    void abortNow();
  };

  const abortNow = async () => {
    if (!runId || aborting) return;
    setAborting(true);
    setLog((prev) => [...prev, `▼ aborting station ${action}…`]);
    try {
      await operations.cancel({ sessionId, executionId: runId });
    } catch (err) {
      setLog((prev) => [...prev, `✗ abort failed: ${(err as Error).message}`]);
      setAborting(false);
    }
  };

  const scrollLog = (delta: number) => {
    const ref = logScrollRef.current;
    if (!ref) return;
    const max = ref.getBottomOffset?.() ?? 0;
    const next = Math.max(0, Math.min(max, logOffsetRef.current + delta));
    ref.scrollTo(next);
    followingRef.current = next >= max;
  };

  useInput((input, key) => {
    if (view !== "detail" || removeTarget) return;
    if (phase === "installing") {
      if (cancelConfirming) return;
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
    if (confirming) {
      if (key.escape) {
        setConfirming(false);
        setConfirmInput("");
        setConfirmError("");
      }
      return;
    }
    if (selecting) {
      if (key.escape) {
        setSelecting(false);
        setSelectedIds(new Set());
        return;
      }
      if (key.upArrow) setServiceCursor((c) => Math.max(0, c - 1));
      else if (key.downArrow) setServiceCursor((c) => Math.min(services.length - 1, c + 1));
      else if (input === " ") {
        const s = serviceAt(serviceCursor);
        if (s) setSelectedIds((prev) => toggleSelection(prev, s.id, services));
      } else if (key.return) {
        if (selectedIds.size === 0) return;
        setSelecting(false);
        setConfirming(true);
        setConfirmInput("");
        setConfirmError("");
      }
      return;
    }
    if (key.escape) {
      onBack();
      return;
    }
    if (input === "n") {
      setView("register-service");
      return;
    }
    if (input === "e") {
      setView("edit");
      return;
    }
    if (services.length === 0) {
      if (input === "i") {
        setError("Add services to this station before installing (press 'n').");
        setPhase("error");
      }
      return;
    }
    if (key.upArrow) setServiceCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) setServiceCursor((c) => Math.min(services.length - 1, c + 1));
    if (key.return) {
      const s = serviceAt(serviceCursor);
      if (s) {
        setOpenServiceId(s.id);
        setView("service");
      }
      return;
    }
    if (input === "i") {
      // Enter selecting mode. Pre-check services that aren't INSTALLED.
      const initial = new Set(services.filter((s) => s.status !== "INSTALLED").map((s) => s.id));
      setAction("install");
      setSelectedIds(initial);
      setSelecting(true);
    }
    if (input === "u") {
      // Uninstall: pre-check the INSTALLED services.
      const installed = services.filter((s) => s.status === "INSTALLED");
      if (installed.length === 0) {
        setError("No installed services to uninstall.");
        setPhase("error");
        return;
      }
      setAction("uninstall");
      setSelectedIds(new Set(installed.map((s) => s.id)));
      setSelecting(true);
    }
    if (input === "r") {
      // Remove (unregister) the focused service. The backend rejects removing
      // an INSTALLED service — surface that up front instead of on submit.
      const s = serviceAt(serviceCursor);
      if (!s) return;
      if (s.status === "INSTALLED") {
        setError(`Uninstall '${s.name}' before removing it from the station.`);
        setPhase("error");
        return;
      }
      setRemoveTarget(s);
    }
  });

  const handleConfirmSubmit = (value: string) => {
    if (value.trim().toLowerCase() === action) {
      const ids = Array.from(selectedIds);
      setConfirming(false);
      setConfirmInput("");
      setConfirmError("");
      setSelectedIds(new Set());
      startInstall(ids, action);
    } else {
      setConfirmError(`type '${action}' to confirm`);
      setConfirmInput("");
    }
  };

  if (view === "service" && openServiceId) {
    return (
      <ServiceDetailScreen
        serviceId={openServiceId}
        onBack={() => {
          setOpenServiceId(null);
          setView("detail");
          reload();
        }}
      />
    );
  }
  if (view === "register-service") {
    return (
      <ServiceForm
        stationId={stationId}
        onBack={() => setView("detail")}
        onSaved={() => {
          setView("detail");
          reload();
        }}
      />
    );
  }
  if (removeTarget) {
    return (
      <ConfirmDeleteScreen
        title="remove service"
        itemId={removeTarget.name}
        entityLabel="service"
        onDelete={() =>
          stationApi.servicesUnregister({ sessionId, stationId, serviceId: removeTarget.id })}
        onConfirmed={() => {
          setRemoveTarget(null);
          reload();
        }}
        onBack={() => setRemoveTarget(null)}
      />
    );
  }
  if (view === "edit" && station) {
    return (
      <StationForm
        mode="edit"
        station={{ id: station.id, name: station.name, description: station.description }}
        onBack={() => setView("detail")}
        onSaved={() => {
          setView("detail");
          reload();
        }}
      />
    );
  }

  if (!station) {
    return (
      <ScreenFrame
        breadcrumb={["topologies", "stations", stationId]}
        footer={<HelpBar>esc back</HelpBar>}
      >
        <Spinner label="loading station..." />
      </ScreenFrame>
    );
  }

  const tone = station.status === "INSTALLED"
    ? "ok"
    : station.status === "FAILED"
    ? "danger"
    : station.status === "INSTALLING"
    ? "warn"
    : "muted";

  const summaryLine = (
    <Box gap={2}>
      <Text>
        {statusDot(tone)} <Text bold>{station.name}</Text>
      </Text>
      <DimText>{station.status}</DimText>
      <DimText>{station.serviceCount} service{station.serviceCount === 1 ? "" : "s"}</DimText>
      {station.description && <DimText>{station.description}</DimText>}
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
    : selecting
    ? "space toggle   ↵ continue   esc cancel"
    : services.length === 0
    ? "n add service   e edit   esc back"
    : "↵ open   i install   u uninstall   r remove   n add service   e edit   esc back";

  return (
    <ScreenFrame
      breadcrumb={["topologies", "stations", station.name]}
      header={summaryLine}
      footer={<HelpBar>{helpText}</HelpBar>}
    >
      {phase === "installing" || phase === "done" || phase === "error" || phase === "aborted"
        ? (
          <RunBody
            action={action}
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
              {selecting
                ? (
                  <PickerTab
                    ordered={ordered}
                    cursor={serviceCursor}
                    selectedIds={selectedIds}
                  />
                )
                : <ServicesTab ordered={ordered} cursor={serviceCursor} />}
            </Box>
            {confirming && (
              <ConfirmPrompt
                action={action}
                stationName={station.name}
                selectedNames={services
                  .filter((s) => selectedIds.has(s.id))
                  .map((s) => s.name)}
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

/** A service tagged with its depth in the host→hosted tree (0 = standalone). */
type OrderedService = { service: StationServiceRecord; depth: number };

/** Indents a service name under its host so the tree structure reads at a glance. */
function treeLabel(name: string, depth: number): string {
  return depth === 0 ? name : `${"  ".repeat(depth - 1)}└ ${name}`;
}

function ServicesTab(
  { ordered, cursor }: { ordered: readonly OrderedService[]; cursor: number },
) {
  const rows = ordered.map(({ service: s, depth }) => ({
    name: treeLabel(s.name, depth),
    blueprint: s.blueprint,
    status: s.status,
    instances: s.host ? `→ ${s.host.serviceName}.${s.host.role}` : `${s.instances.length}`,
    "last install": s.lastInstalledAt ? s.lastInstalledAt.slice(0, 19).replace("T", " ") : "—",
  }));
  return (
    <Box flexDirection="column">
      <Text bold>services</Text>
      <Table
        rows={rows}
        columns={[
          { key: "name" },
          { key: "blueprint" },
          { key: "status" },
          { key: "instances" },
          { key: "last install" },
        ]}
        focusedIndex={ordered.length === 0 ? undefined : cursor}
        emptyMessage="No services. Press 'n' to add one."
      />
    </Box>
  );
}

/**
 * Orders services as a host→hosted tree, depth-first. A standalone service
 * (or one whose host isn't in this station) is a root at depth 0; each service
 * hosted on another nests one level under it. Sibling order follows the
 * original list. Length is preserved, so cursor indices stay valid.
 */
export function orderServiceTree(
  services: readonly StationServiceRecord[],
): OrderedService[] {
  const ids = new Set(services.map((s) => s.id));
  const childrenOf = new Map<string, StationServiceRecord[]>();
  const roots: StationServiceRecord[] = [];
  for (const s of services) {
    const hostId = s.host?.serviceId;
    if (hostId && ids.has(hostId)) {
      const list = childrenOf.get(hostId) ?? [];
      list.push(s);
      childrenOf.set(hostId, list);
    } else {
      roots.push(s);
    }
  }
  const out: OrderedService[] = [];
  const visit = (s: StationServiceRecord, depth: number) => {
    out.push({ service: s, depth });
    for (const child of childrenOf.get(s.id) ?? []) visit(child, depth + 1);
  };
  for (const root of roots) visit(root, 0);
  // Safety net: if a hosting cycle left anything unvisited, append it flat so
  // no service silently disappears from the list.
  if (out.length !== services.length) {
    const seen = new Set(out.map((o) => o.service.id));
    for (const s of services) if (!seen.has(s.id)) out.push({ service: s, depth: 0 });
  }
  return out;
}

function ConfirmPrompt(
  { action, stationName, selectedNames, value, onChange, onSubmit, error }: {
    action: "install" | "uninstall";
    stationName: string;
    selectedNames: string[];
    value: string;
    onChange: (v: string) => void;
    onSubmit: (v: string) => void;
    error: string;
  },
) {
  const summary = selectedNames.length === 1
    ? `service '${selectedNames[0]}'`
    : `${selectedNames.length} services (${selectedNames.join(", ")})`;
  return (
    <Box flexDirection="column" flexShrink={0} marginTop={1}>
      <Text color="yellow">
        {action === "install" ? "Install" : "Uninstall"} {summary} on station '{stationName}'?
      </Text>
      <Text>Type {action} to confirm:</Text>
      {error && <Text color="red">{error}</Text>}
      <Box gap={1}>
        <Text color="yellow">❯</Text>
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

/**
 * Multi-select picker. Each row shows the service status dot + checkbox.
 * Toggling a hosted service whose host isn't INSTALLED auto-includes the
 * host (transitive); unselecting a service auto-removes its dependents.
 */
function PickerTab(
  { ordered, cursor, selectedIds }: {
    ordered: readonly OrderedService[];
    cursor: number;
    selectedIds: Set<string>;
  },
) {
  const rows = ordered.map(({ service: s, depth }) => {
    const tone = s.status === "INSTALLED"
      ? "ok"
      : s.status === "FAILED"
      ? "danger"
      : s.status === "INSTALLING"
      ? "warn"
      : "muted";
    const checkbox = selectedIds.has(s.id) ? "[✓]" : "[ ]";
    return {
      "": `${checkbox} ${statusDot(tone)}`,
      name: treeLabel(s.name, depth),
      blueprint: s.blueprint,
      status: s.status,
      depends: s.host ? `→ ${s.host.serviceName}.${s.host.role}` : "—",
    };
  });
  return (
    <Box flexDirection="column">
      <Text bold>select services to install</Text>
      <DimText>
        space toggles · hosted services auto-include their host
      </DimText>
      <Table
        rows={rows}
        columns={[
          { key: "" },
          { key: "name" },
          { key: "blueprint" },
          { key: "status" },
          { key: "depends" },
        ]}
        focusedIndex={ordered.length === 0 ? undefined : cursor}
        emptyMessage="No services."
      />
    </Box>
  );
}

/**
 * Returns a new selection set after toggling `serviceId`. Adding a hosted
 * service auto-adds its host (if status != INSTALLED). Removing a service
 * auto-removes any service hosted on it.
 */
function toggleSelection(
  current: Set<string>,
  serviceId: string,
  services: readonly StationServiceRecord[],
): Set<string> {
  const next = new Set(current);
  if (next.has(serviceId)) {
    // Remove + transitively drop services that depend on it.
    next.delete(serviceId);
    let changed = true;
    while (changed) {
      changed = false;
      for (const s of services) {
        if (
          next.has(s.id) && s.host && !next.has(s.host.serviceId) &&
          services.some((x) => x.id === s.host!.serviceId)
        ) {
          // dependent's host is no longer selected and not yet INSTALLED — drop the dependent too
          const host = services.find((x) => x.id === s.host!.serviceId);
          if (host && host.status !== "INSTALLED") {
            next.delete(s.id);
            changed = true;
          }
        }
      }
    }
    return next;
  }
  // Add + transitively include host(s) until we reach a INSTALLED ancestor.
  let cursor: StationServiceRecord | undefined = services.find((s) => s.id === serviceId);
  while (cursor) {
    next.add(cursor.id);
    if (!cursor.host) break;
    const host = services.find((s) => s.id === cursor!.host!.serviceId);
    if (!host) break;
    if (host.status === "INSTALLED") break;
    if (next.has(host.id)) break;
    cursor = host;
  }
  return next;
}

function RunBody(
  {
    action,
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
    action: "install" | "uninstall";
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
        {phase === "installing" && (
          <Spinner label={aborting ? "aborting..." : `${action}ing station...`} />
        )}
        {phase === "done" && <Text color="green">✓ station {action} completed</Text>}
        {phase === "error" && <Text color="red">✗ station {action} failed: {error}</Text>}
        {phase === "aborted" && <Text color="yellow">⚠ station {action} aborted</Text>}
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
          <Text color="yellow">Type {CANCEL_TOKEN} to interrupt the run:</Text>
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

function LogPanel(
  { log, phase, aborting, cancelConfirming, scrollRef, offsetRef, followingRef }: {
    log: string[];
    phase: Phase;
    aborting: boolean;
    cancelConfirming: boolean;
    scrollRef: React.RefObject<ScrollViewRef>;
    offsetRef: React.MutableRefObject<number>;
    followingRef: React.MutableRefObject<boolean>;
  },
) {
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
