// AUTO-GENERATED from @jsonrpc-schemas/executions.openrpc.json
// Do not edit by hand — run `deno task contracts:codegen`.

/** Snapshot row in execution.list. */
export class ExecutionRecord {
  constructor(
    readonly id: string,
  ) {}
}

/** Tagged union of events emitted during an operation's lifetime. Discriminated by the `type` field. BCs may extend the union by declaring additional variants in their own schemas that follow the same shape (`type` literal + payload). */
export type ExecutionEvent = Log | Step | Succeeded | Failed | Cancelled;

export class Log {
  readonly type = "log" as const;

  constructor(
    readonly line: string,
  ) {}
}

export class Step {
  readonly type = "step" as const;

  constructor(
    readonly name: string,
    readonly detail?: string | null,
  ) {}
}

/** Terminal — operation completed without error. `result` carries an optional in-process payload (e.g. the installation list a installer task produces for the orchestrator); it is opaque on the wire — UI watchers ignore it and only react to the `succeeded` tag. */
export class Succeeded {
  readonly type = "succeeded" as const;

  constructor(
    readonly result?: unknown,
  ) {}
}

/** Terminal — operation completed with an error. */
export class Failed {
  readonly type = "failed" as const;

  constructor(
    readonly error: string,
  ) {}
}

/** Terminal — operation was cancelled by an explicit execution.cancel. */
export class Cancelled {
  readonly type = "cancelled" as const;
}

/** Params shape for the server-initiated `execution.event` notification. */
export class ExecutionEventNotification {
  constructor(
    readonly executionId: string,
    readonly event: ExecutionEvent,
  ) {}
}

export type Ack = Record<string, unknown>;

/** Request payload for `execution.watch`. */
export interface ExecutionWatchRequest {
  readonly sessionId: string;
  readonly executionId: string;
}

/** Response payload of `execution.watch`. */
export type ExecutionWatchResponse = Ack;

/** Request payload for `execution.cancel`. */
export interface ExecutionCancelRequest {
  readonly sessionId: string;
  readonly executionId: string;
}

/** Response payload of `execution.cancel`. */
export type ExecutionCancelResponse = Ack;

/** Request payload for `execution.list`. */
export interface ExecutionListRequest {
  readonly sessionId: string;
}

/** Response payload of `execution.list`. */
export type ExecutionListResponse = ReadonlyArray<ExecutionRecord>;
