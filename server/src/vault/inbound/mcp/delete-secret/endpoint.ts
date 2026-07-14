import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DeleteSecretHandler } from "@server/vault/application/handlers/delete-secret-handler.ts";
import { DeleteSecret } from "@server/vault/application/commands/delete-secret.ts";

type Args = {
  vaultId: string;
  secretId: string;
};

/**
 * MCP endpoint `devstation_vault_secret_delete` — permanently deletes a
 * secret from a vault. Handler-direct counterpart of
 * `vault.secrets.delete` RPC.
 */
export class DeleteSecretMcpEndpoint
  implements Endpoint<"devstation_vault_secret_delete", Args, Record<string, never>> {
  readonly name = "devstation_vault_secret_delete" as const;
  readonly title = "Delete secret";
  readonly description = "Permanently deletes a secret from a vault.";
  readonly risk = "destructive" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      vaultId: { type: "string" },
      secretId: { type: "string" },
    },
    required: ["vaultId", "secretId"],
    additionalProperties: false,
  };

  constructor(private readonly handler: DeleteSecretHandler) {}

  async dispatch(args: Args): Promise<Record<string, never>> {
    await this.handler.handle(new DeleteSecret(args.vaultId, args.secretId));
    return {};
  }
}
