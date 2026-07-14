import type { ExecutionEvent } from "@jsonrpc-contracts-ts/executions.gen.ts";

/**
 * Terminal events close an operation's stream — no event follows and
 * watchers stop iterating. The canonical terminals are `succeeded`
 * (successful completion), `failed` (uncaught error) and `cancelled`
 * (external cancellation).
 *
 * Discrimination is by the wire `type` tag (the events are codegen
 * classes; there is no `instanceof`-able domain marker anymore).
 */
const TERMINAL_TYPES: ReadonlySet<string> = new Set(["succeeded", "failed", "cancelled"]);

export const isTerminal = (event: ExecutionEvent): boolean => TERMINAL_TYPES.has(event.type);
