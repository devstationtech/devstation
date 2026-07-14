/**
 * The execution event vocabulary is schema-canonical: the tagged union
 * lives in `@jsonrpc-schemas/executions.openrpc.json` and the classes
 * (Log, Step, Succeeded, Failed, Cancelled) are codegen'd from it. There
 * is no separate domain representation and therefore no wire mapper —
 * `new Log("…")` already produces the exact wire shape.
 *
 * This module re-exports the generated union so domain ports
 * (`Task`, `Execution`) keep a stable shared import path.
 *
 * Named `ExecutionEvent` (not `Event`) to avoid clashing with the DOM
 * `Event` global available in Deno.
 */
export type { ExecutionEvent } from "@jsonrpc-contracts-ts/executions.gen.ts";
