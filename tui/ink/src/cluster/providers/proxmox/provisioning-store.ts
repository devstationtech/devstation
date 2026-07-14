/// <reference types="@types/react" />
import { useSyncExternalStore } from "react";
import type { ClusterIntegration } from "@ui/shared/integrations/cluster-integration.ts";
import type { ClusterEventIntegration } from "@ui/shared/integrations/cluster-event-integration.ts";
import type { ExecutionsIntegration } from "@ui/shared/integrations/executions-integration.ts";
import { clearActiveRun, setActiveRun } from "@ui/shared/hooks/use-active-runs.ts";

/**
 * RPC dependencies the store needs. Built by the React component
 * (`provisioning-tab.tsx`) from `useSessionId()` + `useCluster()` +
 * `useOperations()` and passed in — the store is module-level (not a
 * React component) so it cannot read context itself.
 */
export interface ProvisioningDeps {
  readonly sessionId: string;
  readonly cluster: ClusterIntegration;
  readonly clusterEvents: ClusterEventIntegration;
  readonly operations: ExecutionsIntegration;
}

export type Phase = "idle" | "running" | "done" | "error";

export type RunAction = "plan" | "apply" | "destroy";

export type RequiredImage = {
  nodeId: string;
  nodeName: string;
  imageId: string;
  imageName: string;
};

export type RunState = {
  phase: Phase;
  runAction: RunAction | null;
  runId: string | null;
  aborting: boolean;
  cancelConfirming: boolean;
  pendingConfirm: RunAction | null;
  log: string[];
  error: string;
  // Set of completed nodeIds for the active run, fed by cluster domain
  // events over `cluster.subscribe` (NodePlanSucceeded/NodeApplySucceeded/
  // NodeDestroySucceeded). Completion is per-node — the V1 events carry only
  // clusterId/nodeId (no env), matching the domain state machine which
  // transitions whole nodes. The TaskList renders a row per (node,env)
  // but a node's rows all reflect that node's completion.
  completedTasks: Set<string>;
  selected: Set<string>;
};

const INITIAL: RunState = {
  phase: "idle",
  runAction: null,
  runId: null,
  aborting: false,
  cancelConfirming: false,
  pendingConfirm: null,
  log: [],
  error: "",
  completedTasks: new Set(),
  selected: new Set(),
};

const states = new Map<string, RunState>();
const listeners = new Map<string, Set<() => void>>();
const globalListeners = new Set<() => void>();

function notifyAll(): void {
  globalListeners.forEach((l) => l());
}

function getOrInit(clusterId: string): RunState {
  let s = states.get(clusterId);
  if (!s) {
    s = { ...INITIAL, completedTasks: new Set(), selected: new Set(), log: [] };
    states.set(clusterId, s);
  }
  return s;
}

function notify(clusterId: string): void {
  listeners.get(clusterId)?.forEach((l) => l());
  notifyAll();
}

function update(clusterId: string, patch: Partial<RunState>): void {
  const cur = getOrInit(clusterId);
  states.set(clusterId, { ...cur, ...patch });
  if (patch.phase) {
    if (patch.phase === "running") setActiveRun(`proxmox:${clusterId}`);
    else clearActiveRun(`proxmox:${clusterId}`);
  }
  notify(clusterId);
}

export function getState(clusterId: string): RunState {
  return getOrInit(clusterId);
}

export function setSelected(clusterId: string, selected: Set<string>): void {
  update(clusterId, { selected });
}

export function setPhase(clusterId: string, phase: Phase): void {
  update(clusterId, { phase });
}

export function setCancelConfirming(clusterId: string, cancelConfirming: boolean): void {
  update(clusterId, { cancelConfirming });
}

export function setPendingConfirm(clusterId: string, pendingConfirm: RunAction | null): void {
  update(clusterId, { pendingConfirm });
}

export function isRunning(clusterId: string): boolean {
  return getOrInit(clusterId).phase === "running";
}

export function runningClusterIds(): string[] {
  const ids: string[] = [];
  for (const [id, s] of states) if (s.phase === "running") ids.push(id);
  return ids;
}

function subscribeAll(listener: () => void): () => void {
  globalListeners.add(listener);
  return () => {
    globalListeners.delete(listener);
  };
}

export function useIsRunning(clusterId: string): boolean {
  return useSyncExternalStore(
    (l) => subscribe(clusterId, l),
    () => getOrInit(clusterId).phase === "running",
  );
}

export function useAnyRunning(): boolean {
  return useSyncExternalStore(
    subscribeAll,
    () => runningClusterIds().length > 0,
  );
}

function subscribe(clusterId: string, listener: () => void): () => void {
  let set = listeners.get(clusterId);
  if (!set) {
    set = new Set();
    listeners.set(clusterId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
  };
}

export function useRunState(clusterId: string): RunState {
  return useSyncExternalStore(
    (l) => subscribe(clusterId, l),
    () => getOrInit(clusterId),
  );
}

export function helpText(clusterId: string): string {
  const s = getOrInit(clusterId);
  if (s.phase === "running") {
    if (s.cancelConfirming) return "↵ confirm   esc back";
    if (s.aborting) return "↑↓ scroll   PgUp/PgDn page";
    return "c cancel   ↑↓ scroll   PgUp/PgDn page";
  }
  if (s.phase === "done" && s.runAction === "plan") {
    return "a/↵ apply   ↑↓ scroll   PgUp/PgDn page   esc back";
  }
  if (s.phase === "done" || s.phase === "error") {
    return "↵/esc back   ↑↓ scroll   PgUp/PgDn page";
  }
  // idle.
  if (s.pendingConfirm) return "↵ confirm   esc back";
  return s.selected.size === 0
    ? "↑↓ move   space toggle   A all   N none"
    : "↑↓ move   space toggle   A all   N none   p plan   a apply   d destroy";
}

export function useProvisioningHelp(clusterId: string): string {
  return useSyncExternalStore(
    (l) => subscribe(clusterId, l),
    () => helpText(clusterId),
  );
}

// Buffered log flush: the provisioning runner can dump many lines in quick succession; pushing
// each one through the store synchronously starves the Ink event loop and makes
// input/rendering feel laggy on other screens. We coalesce into ~100ms windows
// and cap the persisted log to MAX_LOG_LINES so an unbounded array does not
// turn each render into an O(N) copy that grows over time.
const LOG_FLUSH_MS = 100;
const MAX_LOG_LINES = 500;
const logBuffers = new Map<string, string[]>();
const flushTimers = new Map<string, ReturnType<typeof setTimeout>>();

function flushLog(clusterId: string): void {
  const buf = logBuffers.get(clusterId);
  flushTimers.delete(clusterId);
  if (!buf || buf.length === 0) return;
  logBuffers.set(clusterId, []);
  const cur = getOrInit(clusterId);
  const merged = [...cur.log, ...buf];
  states.set(clusterId, {
    ...cur,
    log: merged.length > MAX_LOG_LINES ? merged.slice(-MAX_LOG_LINES) : merged,
  });
  notify(clusterId);
}

function appendLog(clusterId: string, line: string): void {
  let buf = logBuffers.get(clusterId);
  if (!buf) {
    buf = [];
    logBuffers.set(clusterId, buf);
  }
  buf.push(line);
  if (!flushTimers.has(clusterId)) {
    flushTimers.set(clusterId, setTimeout(() => flushLog(clusterId), LOG_FLUSH_MS));
  }
}

function flushLogNow(clusterId: string): void {
  const t = flushTimers.get(clusterId);
  if (t) clearTimeout(t);
  flushLog(clusterId);
}

// Yield to the macrotask queue every N stream items so Ink's input/render loop
// gets a turn even while the runner is producing output non-stop. Lower values
// improve responsiveness at the cost of throughput; 5 keeps key handling
// snappy when the runner dumps hundreds of lines in a burst.
const YIELD_EVERY = 5;
const yieldToEventLoop = () => new Promise<void>((r) => setTimeout(r, 0));

function resetRun(clusterId: string, runAction: RunAction): void {
  update(clusterId, {
    phase: "running",
    runAction,
    runId: null,
    aborting: false,
    cancelConfirming: false,
    pendingConfirm: null,
    log: [],
    error: "",
    completedTasks: new Set(),
  });
}

async function watchTerminal(
  deps: ProvisioningDeps,
  clusterId: string,
  executionId: string,
): Promise<void> {
  const stream = deps.operations.watch({ sessionId: deps.sessionId, executionId });
  let i = 0;
  for await (const output of stream) {
    if (output.type === "log") {
      if (output.line) appendLog(clusterId, output.line);
    } else if (output.type === "step") {
      appendLog(
        clusterId,
        `▼ ${output.name}${output.detail ? ` — ${output.detail}` : ""}`,
      );
    } else if (output.type === "succeeded") {
      flushLogNow(clusterId);
      return;
    } else if (output.type === "failed") {
      flushLogNow(clusterId);
      throw new Error(output.error);
    } else if (output.type === "cancelled") {
      flushLogNow(clusterId);
      throw new Error("execution aborted");
    }
    if (++i % YIELD_EVERY === 0) await yieldToEventLoop();
  }
  flushLogNow(clusterId);
  throw new Error("execution stream ended without terminal output");
}

const NODE_COMPLETED_EVENTS: ReadonlySet<string> = new Set([
  "node-plan-succeeded",
  "node-apply-succeeded",
  "node-destroy-succeeded",
]);

// Failure is a reliable cluster domain event the UI already receives but
// used to ignore — the execution-stream terminal was the only thing
// driving `phase`, and when it doesn't arrive the spinner span forever.
// Reacting to these makes the screen surface the error regardless.
const NODE_FAILED_EVENTS: ReadonlySet<string> = new Set([
  "node-plan-failed",
  "node-apply-failed",
  "node-destroy-failed",
]);

function failureMessage(type: string, nodeId: string): string {
  const phase = type === "node-plan-failed"
    ? "planning"
    : type === "node-apply-failed"
    ? "provisioning"
    : "destroy";
  return `${phase} failed for node ${nodeId} — see log above`;
}

function markNodeCompleted(clusterId: string, nodeId: string): void {
  const next = new Set(getOrInit(clusterId).completedTasks);
  next.add(nodeId);
  update(clusterId, { completedTasks: next });
}

type NodeProgress = {
  /** Resolves with a message the first time a node-*-failed event arrives. */
  readonly failure: Promise<string>;
  /**
   * Resolves once every expected node has emitted a *-completed event —
   * the success counterpart of `failure`, so a hung/missing execution
   * terminal can no longer trap a *successful* run in the spinner.
   * Never resolves when the expected set is empty (caller relies on the
   * execution terminal then).
   */
  readonly completion: Promise<void>;
  /** Stop iterating + unsubscribe. MUST be awaited in a `finally`. */
  readonly stop: () => Promise<void>;
};

/**
 * Subscribe to the cluster's domain-event stream for the lifetime of a
 * run: mark each node done as its terminal lifecycle event arrives, and
 * resolve `failure` on the first node-*-failed event.
 *
 * The subscription is open-ended (`cluster.subscribe` is
 * register-and-return), so `stop()` MUST be invoked in a `finally` to
 * stop iterating — that triggers the generator's `finally` and
 * unsubscribes, preventing a leak across runs. Failure is surfaced here
 * because the execution-stream terminal is not reliable enough to be the
 * only thing driving `phase` (it can hang, leaving the spinner forever).
 */
function trackNodeProgress(
  deps: ProvisioningDeps,
  clusterId: string,
  expectedNodeIds: readonly string[],
): NodeProgress {
  const iterator = deps.clusterEvents
    .watch({ sessionId: deps.sessionId, clusterId })
    [Symbol.asyncIterator]();
  const failed = Promise.withResolvers<string>();
  const completed = Promise.withResolvers<void>();
  const expected = new Set(expectedNodeIds);
  const doneNodes = new Set<string>();
  const pump = (async () => {
    try {
      while (true) {
        const { done, value } = await iterator.next();
        if (done) return;
        if (NODE_COMPLETED_EVENTS.has(value.type)) {
          markNodeCompleted(clusterId, value.nodeId);
          if (expected.has(value.nodeId)) {
            doneNodes.add(value.nodeId);
            if (doneNodes.size >= expected.size) {
              completed.resolve();
              return;
            }
          }
        } else if (NODE_FAILED_EVENTS.has(value.type)) {
          failed.resolve(failureMessage(value.type, value.nodeId));
          return;
        }
      }
    } catch {
      // best-effort; failure/success also flow through watchTerminal.
    }
  })();
  return {
    failure: failed.promise,
    completion: completed.promise,
    stop: async () => {
      await iterator.return?.();
      await pump;
    },
  };
}

/**
 * Await a run to a terminal outcome. Races the execution-stream terminal
 * (`watchTerminal`) against a node-*-failed domain event so a hung or
 * missing terminal can no longer trap the UI in the running phase.
 */
// When failure is signalled by the cluster domain event (which arrives
// via the dispatcher, often before the execution stream finishes
// flushing the runner's error output), give the stream a short window to
// drain so "see log above" actually has the log. The execution-stream
// terminal also carries a more detailed message — prefer it if it lands
// within the window.
const FAIL_DRAIN_MS = 2000;
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function awaitRun(
  deps: ProvisioningDeps,
  clusterId: string,
  executionId: string,
  expectedNodeIds: readonly string[],
): Promise<void> {
  const progress = trackNodeProgress(deps, clusterId, expectedNodeIds);
  // Wrapped so it never rejects unhandled when another branch wins;
  // it keeps consuming the stream (appending logs) in the background.
  const terminal = watchTerminal(deps, clusterId, executionId)
    .then(() => ({ kind: "ok" as const }))
    .catch((e: Error) => ({ kind: "err" as const, error: e }));

  try {
    const first = await Promise.race([
      terminal,
      progress.failure.then((msg) => ({ kind: "fail" as const, msg })),
      // Success counterpart: every expected node completed. A hung/
      // missing execution terminal must not trap a successful run.
      progress.completion.then(() => ({ kind: "ok" as const })),
    ]);

    if (first.kind === "ok") {
      flushLogNow(clusterId);
      return;
    }
    if (first.kind === "err") {
      flushLogNow(clusterId);
      throw first.error;
    }

    // Domain-event failure: let the stream drain its error/logs briefly,
    // and prefer its detailed message if it settles in time.
    const drained = await Promise.race([terminal, delay(FAIL_DRAIN_MS)]);
    flushLogNow(clusterId);
    if (drained && (drained as { kind: string }).kind === "err") {
      throw (drained as { kind: "err"; error: Error }).error;
    }
    throw new Error(first.msg);
  } finally {
    await progress.stop();
  }
}

/**
 * Pre-apply step: materialize each required node image.
 *
 * `cluster.imagesCreate` is LSP-style on the server (the request stays
 * pending, streaming `execution.event`, resolving with an Ack only when
 * the image is ready, or throwing on failure). The integration here
 * awaits that completion — live per-image provisioning sub-logs are not
 * surfaced (the executionId arrives via an `operation.started`
 * notification, not a watchable handle). Acceptable degradation,
 * consistent with the "logs suffice for now" direction; the bracketing
 * log lines below keep the user informed. Follow-up: expose the
 * imagesCreate event stream if live sub-logs become necessary.
 */
async function ensureImages(
  deps: ProvisioningDeps,
  clusterId: string,
  images: RequiredImage[],
): Promise<void> {
  for (const t of images) {
    // Honor a cancel pressed during the pre-apply image phase (when
    // there is no provisioning executionId yet) — stop before the next
    // image instead of silently pressing on.
    if (getOrInit(clusterId).aborting) throw new Error("execution aborted");
    appendLog(clusterId, `▼ image ${t.imageName} on ${t.nodeName}`);
    await deps.cluster.imagesCreate(
      {
        sessionId: deps.sessionId,
        clusterId,
        nodeId: t.nodeId,
        imageId: t.imageId,
      },
      (line) => appendLog(clusterId, line),
    );
    appendLog(clusterId, `✓ image ${t.imageName} (${t.nodeName}) ready`);
  }
}

export async function startPlan(
  deps: ProvisioningDeps,
  clusterId: string,
  selectedNodes: string[],
): Promise<void> {
  resetRun(clusterId, "plan");
  try {
    const { executionId } = await deps.cluster.provisioningPlan({
      sessionId: deps.sessionId,
      clusterId,
      nodeIds: selectedNodes,
    });
    update(clusterId, { runId: executionId });
    await awaitRun(deps, clusterId, executionId, selectedNodes);
    update(clusterId, { phase: "done", runId: null });
  } catch (err) {
    update(clusterId, { phase: "error", error: (err as Error).message, runId: null });
  }
}

export async function startApply(
  deps: ProvisioningDeps,
  clusterId: string,
  selectedNodes: string[],
  images: RequiredImage[],
): Promise<void> {
  resetRun(clusterId, "apply");
  try {
    await ensureImages(deps, clusterId, images);
    // A cancel during the image phase has no provisioning execution to
    // target yet — don't start the apply if abort was requested.
    if (getOrInit(clusterId).aborting) throw new Error("execution aborted");
    const { executionId } = await deps.cluster.provisioningApply({
      sessionId: deps.sessionId,
      clusterId,
      nodeIds: selectedNodes,
    });
    update(clusterId, { runId: executionId });
    await awaitRun(deps, clusterId, executionId, selectedNodes);
    update(clusterId, { phase: "done", runId: null });
  } catch (err) {
    update(clusterId, { phase: "error", error: (err as Error).message, runId: null });
  }
}

export async function startDestroy(
  deps: ProvisioningDeps,
  clusterId: string,
  selectedNodes: string[],
): Promise<void> {
  resetRun(clusterId, "destroy");
  try {
    const { executionId } = await deps.cluster.provisioningDestroy({
      sessionId: deps.sessionId,
      clusterId,
      nodeIds: selectedNodes,
    });
    update(clusterId, { runId: executionId });
    await awaitRun(deps, clusterId, executionId, selectedNodes);
    update(clusterId, { phase: "done", runId: null });
  } catch (err) {
    update(clusterId, { phase: "error", error: (err as Error).message, runId: null });
  }
}

export async function abortRun(
  deps: ProvisioningDeps,
  clusterId: string,
): Promise<void> {
  const cur = getOrInit(clusterId);
  if (cur.phase !== "running" || cur.aborting) return;
  update(clusterId, { aborting: true });
  appendLog(clusterId, "▼ aborting run…");
  // When a provisioning execution is running, ask the server to cancel it.
  // With no runId yet (pre-apply image phase) the aborting flag alone is
  // honored by ensureImages/startApply — earlier this returned silently
  // here, so the first cancel looked ignored.
  if (cur.runId) {
    try {
      await deps.operations.cancel({ sessionId: deps.sessionId, executionId: cur.runId });
    } catch (err) {
      appendLog(clusterId, `✗ abort failed: ${(err as Error).message}`);
    }
  }
  // The execution stream's Cancelled terminal is not reliable enough to
  // end the run on its own (same class as the failure/success hangs):
  // the UI would stay stuck on "aborting" forever. Give the normal abort
  // path a brief grace, then force the terminal. `aborting` stays true
  // so a still-pending ensureImages/startApply also short-circuits.
  await delay(ABORT_GRACE_MS);
  if (getOrInit(clusterId).phase === "running") {
    appendLog(clusterId, "✓ aborted");
    flushLogNow(clusterId);
    update(clusterId, { phase: "error", error: "execution aborted", runId: null });
  }
}

const ABORT_GRACE_MS = 2000;
