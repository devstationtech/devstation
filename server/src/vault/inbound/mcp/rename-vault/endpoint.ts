import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { RenameVaultHandler } from "@server/vault/application/handlers/rename-vault-handler.ts";
import { RenameVault } from "@server/vault/application/commands/rename-vault.ts";

type Args = { vaultId: string; name: string };

/**
 * MCP endpoint `devstation_vault_rename` — renames a vault in place; the id
 * (and every reference to it) is preserved. Counterpart of `vault.rename` RPC.
 */
export class RenameVaultMcpEndpoint
  implements Endpoint<"devstation_vault_rename", Args, Record<string, never>> {
  readonly name = "devstation_vault_rename" as const;
  readonly title = "Rename vault";
  readonly description = "Renames a vault in place (id preserved).";
  readonly risk = "mutating" as const;
  readonly inputSchema = {
    type: "object",
    properties: { vaultId: { type: "string" }, name: { type: "string" } },
    required: ["vaultId", "name"],
    additionalProperties: false,
  };

  constructor(private readonly handler: RenameVaultHandler) {}

  async dispatch(args: Args): Promise<Record<string, never>> {
    await this.handler.handle(new RenameVault(args.vaultId, args.name));
    return {};
  }
}
