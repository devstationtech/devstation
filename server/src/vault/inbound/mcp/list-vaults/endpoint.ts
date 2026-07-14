import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as AllVaultsQuery } from "@server/vault/application/queries/all/query.ts";

/**
 * MCP endpoint `devstation_vault_list` — all vaults with their summary.
 * Query-direct counterpart of `vault.list` RPC.
 */
export class ListVaultsMcpEndpoint
  implements Endpoint<"devstation_vault_list", Record<string, never>, unknown> {
  readonly name = "devstation_vault_list" as const;
  readonly title = "List vaults";
  readonly description = "All vaults with their summary.";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: {},
    additionalProperties: false,
  };

  constructor(private readonly query: AllVaultsQuery) {}

  async dispatch(): Promise<unknown> {
    return await this.query.execute();
  }
}
