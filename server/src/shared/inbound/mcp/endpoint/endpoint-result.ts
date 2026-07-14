/**
 * Wire-shape returned by `EndpointRegistry.call` — directly
 * serialisable as an MCP `tools/call` result. `isError: true` flips
 * the SDK's conversion so the agent sees an explicit failure rather
 * than a stringified payload.
 *
 * Parallel to RPC's response envelope (success vs failure); here the
 * MCP SDK contract forces the `{ content: [...], isError? }` shape.
 */
export interface EndpointResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}
