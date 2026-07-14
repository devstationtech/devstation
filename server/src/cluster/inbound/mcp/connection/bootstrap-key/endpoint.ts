import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { BootstrapKeyHandler } from "@server/cluster/application/handlers/connection/bootstrap-key-handler.ts";

type Args = {
  clusterId: string;
  nodeId: string;
};

/**
 * MCP endpoint `devstation_cluster_connection_bootstrap_key` — installs
 * the DevStation automation public key on a registered node so
 * subsequent SSH ops go key-only. The caller passes only the ids —
 * host, user and password are resolved server-side from the node's
 * vault entries (never crosses the wire). State-changing on the
 * remote (writes to `authorized_keys`), idempotent (no-op if already
 * present), always backs up before writing.
 */
export class BootstrapKeyMcpEndpoint
  implements Endpoint<"devstation_cluster_connection_bootstrap_key", Args, unknown> {
  readonly name = "devstation_cluster_connection_bootstrap_key" as const;
  readonly title = "Bootstrap SSH key on remote";
  readonly description =
    "One-shot SSH bootstrap of a registered node: reads its credentials from the vault, connects with password, and installs the DevStation public key so subsequent automation runs key-only. Detects Proxmox pmxcfs and handles its read-only authorized_keys; idempotent; backs up before writing; never touches private keys.";
  readonly risk = "mutating" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      clusterId: { type: "string" },
      nodeId: { type: "string" },
    },
    required: ["clusterId", "nodeId"],
    additionalProperties: false,
  };

  constructor(private readonly handler: BootstrapKeyHandler) {}

  async dispatch(args: Args): Promise<unknown> {
    return await this.handler.handle({
      clusterId: args.clusterId,
      nodeId: args.nodeId,
    });
  }
}
