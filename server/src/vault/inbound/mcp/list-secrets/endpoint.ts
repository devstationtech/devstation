import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as AllSecretsQuery } from "@server/vault/application/queries/secrets/all/query.ts";

type Args = {
  vaultId: string;
};

/**
 * MCP endpoint `devstation_vault_secrets_list` — all secrets (metadata
 * only, no values) for a given vault. Query-direct counterpart of
 * `vault.secrets.list` RPC.
 */
export class ListSecretsMcpEndpoint
  implements Endpoint<"devstation_vault_secrets_list", Args, unknown> {
  readonly name = "devstation_vault_secrets_list" as const;
  readonly title = "List secrets";
  readonly description =
    "All secrets (metadata only — names, ids, creation info) for a given vault. Secret values are never returned.";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      vaultId: { type: "string" },
    },
    required: ["vaultId"],
    additionalProperties: false,
  };

  constructor(private readonly query: AllSecretsQuery) {}

  async dispatch(args: Args): Promise<unknown> {
    return await this.query.execute(args.vaultId);
  }
}
