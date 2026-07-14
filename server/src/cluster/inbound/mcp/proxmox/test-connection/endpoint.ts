import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as TestProxmoxConnectionQuery } from "@server/cluster/application/queries/proxmox/test-connection/query.ts";

type Args = {
  host: string;
  token: string;
  /**
   * Accepted for forward compatibility. The engine bypasses certificate
   * validation unconditionally, so this field is a no-op; it stays on
   * the schema to avoid rejecting older clients that send it.
   */
  skipTlsVerification?: boolean;
};

/**
 * MCP endpoint `devstation_cluster_test_connection` — pings a Proxmox API
 * with the given host + token and reports back the discriminated outcome.
 * Read-only; never throws on connection failure.
 */
export class TestProxmoxConnectionMcpEndpoint
  implements Endpoint<"devstation_cluster_test_connection", Args, unknown> {
  readonly name = "devstation_cluster_test_connection" as const;
  readonly title = "Test Proxmox Connection";
  readonly description =
    "Pings a Proxmox API with the given host + token and reports back the discriminated outcome. Never throws on connection failure.";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      host: { type: "string" },
      token: { type: "string" },
      skipTlsVerification: {
        type: "boolean",
        description: "Accepted for backwards compatibility — no-op; the engine " +
          "bypasses certificate validation unconditionally.",
      },
    },
    required: ["host", "token"],
    additionalProperties: false,
  };

  constructor(private readonly query: TestProxmoxConnectionQuery) {}

  async dispatch(args: Args): Promise<unknown> {
    return await this.query.execute(args.host, args.token);
  }
}
