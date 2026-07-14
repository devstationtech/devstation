import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { JsonSchema } from "@server/shared/inbound/mcp/json-schema.ts";
import type { CreateVaultHandler } from "@server/vault/application/handlers/create-vault-handler.ts";
import { CreateVault } from "@server/vault/application/commands/create-vault.ts";
import { resolveActor } from "@server/shared/inbound/mcp/actor.ts";
import { slugSchema } from "@server/shared/inbound/mcp/json-schema-slug.ts";

type Args = {
  name: string;
  user?: string;
  hostname?: string;
};

/**
 * MCP endpoint `devstation_vault_create` — creates a new vault.
 * Handler-direct counterpart of `vault.create` RPC.
 */
export class CreateVaultMcpEndpoint implements
  Endpoint<
    "devstation_vault_create",
    Args,
    { vaultId: string; name: string }
  > {
  readonly name = "devstation_vault_create" as const;
  readonly title = "Create vault";
  readonly description = "Creates a new vault to store encrypted secrets.";
  readonly risk = "mutating" as const;
  readonly inputSchema: JsonSchema = {
    type: "object",
    properties: {
      name: slugSchema({
        description: "Vault name. Lowercase slug — letters, digits and hyphens only " +
          "(must start and end with a letter or digit). Max 64 chars.",
      }),
      user: {
        type: "string",
        description: "Optional — defaults to the OS user running the engine.",
      },
      hostname: {
        type: "string",
        description: "Optional — defaults to the engine host's name.",
      },
    },
    required: ["name"],
    additionalProperties: false,
  };

  constructor(private readonly handler: CreateVaultHandler) {}

  async dispatch(args: Args): Promise<{ vaultId: string; name: string }> {
    const actor = resolveActor(args);
    // Return the server-generated id so callers don't need a list round-trip.
    const { vaultId } = await this.handler.handle(
      new CreateVault(args.name, actor.user, actor.hostname),
    );
    return { vaultId, name: args.name };
  }
}
