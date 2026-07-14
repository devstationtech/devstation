import type { RiskTier } from "@server/shared/inbound/mcp/policy/risk-tier.ts";
import type { JsonSchema } from "@server/shared/inbound/mcp/json-schema.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";

/**
 * An MCP endpoint exposes a single operation to MCP clients (one per
 * tool name on the wire). Each BC declares its own endpoints (one
 * class per method, mirroring `inbound/rpc/<m>/endpoint.ts`): the BC
 * owns the wire name, the typed Args/Result, and the dispatch glue
 * that builds a Command and calls the application Handler **directly**
 * (no JSON-RPC indirection).
 *
 * `risk` + `inputSchema` are MCP-only concerns the SDK ships to
 * clients via `tools/list`; `description` is wrapped with `[risk]` by
 * the registry. Wire-level the MCP SDK calls these "tools"; in code
 * they're `Endpoint` (folder-namespaced to `mcp/endpoint/`) so the
 * shape parallels RPC's `endpoint/Endpoint` exactly.
 */
export interface Endpoint<N extends string, Args, Result> {
  /** Wire-level tool name (e.g. `"devstation_cluster_list"`). */
  readonly name: N;
  /** Human-friendly title (clients render it in their tool UI). */
  readonly title: string;
  /** Behaviour description; the registry prefixes `[risk]` automatically. */
  readonly description: string;
  readonly risk: RiskTier;
  readonly inputSchema: JsonSchema;

  /**
   * Receives decoded args + dispatch context, returns a JSON-able
   * value. The registry wraps the value into the wire envelope (`{
   * content: [{ type: "text", text: JSON.stringify(...) }] }`) and
   * maps thrown `PolicyViolation` / generic errors to `isError: true`.
   *
   * Implementations call **the application handler directly** — they
   * must NOT go through `gateway.call(...)` (which routes through the
   * JSON-RPC layer and adds unnecessary indirection).
   */
  dispatch(args: Args, ctx: DispatchContext): Promise<Result> | Result;
}
