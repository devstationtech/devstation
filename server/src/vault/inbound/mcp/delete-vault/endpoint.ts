import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DeleteVaultHandler } from "@server/vault/application/handlers/delete-vault-handler.ts";
import { DeleteVault } from "@server/vault/application/commands/delete-vault.ts";

type Args = {
  vaultId: string;
};

/**
 * MCP endpoint `devstation_vault_delete` — permanently deletes a vault.
 * Handler-direct counterpart of `vault.delete` RPC.
 */
export class DeleteVaultMcpEndpoint
  implements Endpoint<"devstation_vault_delete", Args, Record<string, never>> {
  readonly name = "devstation_vault_delete" as const;
  readonly title = "Delete vault";
  readonly description = "Permanently deletes a vault and all its secrets.";
  readonly risk = "destructive" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      vaultId: { type: "string" },
    },
    required: ["vaultId"],
    additionalProperties: false,
  };

  constructor(private readonly handler: DeleteVaultHandler) {}

  async dispatch(args: Args): Promise<Record<string, never>> {
    await this.handler.handle(new DeleteVault(args.vaultId));
    return {};
  }
}
