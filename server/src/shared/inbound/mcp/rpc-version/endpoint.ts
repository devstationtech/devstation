import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import { Protocol } from "@server/shared/inbound/rpc/protocol.ts";

/**
 * MCP endpoint `devstation_rpc_version` — handshake metadata. Mirrors
 * the inline `rpc.version` short-circuit in `src/shared/inbound/rpc/
 * server.ts`. Single shared endpoint (no BC affiliation).
 *
 * The `core` value is injected at construction (same string the RPC
 * Server was instantiated with), keeping the source of truth single
 * across both ports.
 */
export class RpcVersionMcpEndpoint implements
  Endpoint<
    "devstation_rpc_version",
    Record<string, never>,
    { protocol: typeof Protocol.VERSION; core: string }
  > {
  readonly name = "devstation_rpc_version" as const;
  readonly title = "Core version";
  readonly description = "JSON-RPC core/protocol handshake.";
  readonly risk = "read" as const;
  readonly inputSchema = { type: "object", properties: {}, additionalProperties: false };

  constructor(private readonly core: string) {}

  dispatch(): { protocol: typeof Protocol.VERSION; core: string } {
    return Protocol.handshake(this.core);
  }
}
