import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { RenameSecretHandler } from "@server/vault/application/handlers/rename-secret-handler.ts";
import { RenameSecret } from "@server/vault/application/commands/rename-secret.ts";

type Args = { vaultId: string; secretId: string; name: string };

/**
 * MCP endpoint `devstation_vault_secret_rename` — renames a secret in place,
 * preserving its id so service references keep working. Counterpart of
 * `vault.secrets.rename` RPC.
 */
export class RenameSecretMcpEndpoint
  implements Endpoint<"devstation_vault_secret_rename", Args, Record<string, never>> {
  readonly name = "devstation_vault_secret_rename" as const;
  readonly title = "Rename secret";
  readonly description = "Renames a secret in place (id preserved, references kept).";
  readonly risk = "mutating" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      vaultId: { type: "string" },
      secretId: { type: "string" },
      name: { type: "string" },
    },
    required: ["vaultId", "secretId", "name"],
    additionalProperties: false,
  };

  constructor(private readonly handler: RenameSecretHandler) {}

  async dispatch(args: Args): Promise<Record<string, never>> {
    await this.handler.handle(new RenameSecret(args.vaultId, args.secretId, args.name));
    return {};
  }
}
