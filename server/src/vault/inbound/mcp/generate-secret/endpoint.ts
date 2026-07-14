import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { GenerateSecretHandler } from "@server/vault/application/handlers/generate-secret-handler.ts";
import { GenerateSecret } from "@server/vault/application/commands/generate-secret.ts";
import type { SessionResolver } from "@server/shared/authentication/domain/ports/outbound/session-resolver.ts";
import { resolveActor } from "@server/shared/inbound/mcp/actor.ts";

type Args = {
  vaultId: string;
  name: string;
  hostname?: string;
  user?: string;
  value?: string;
  description?: string;
};

/**
 * MCP endpoint `devstation_vault_secret_generate` — generates (or
 * regenerates) an encrypted secret in a vault. Uses the standing MCP
 * session key installed at boot by `bootMcpServer()` via
 * `SessionResolver`. Handler-direct counterpart of
 * `vault.secrets.generate` RPC.
 */
export class GenerateSecretMcpEndpoint implements
  Endpoint<
    "devstation_vault_secret_generate",
    Args,
    { secretId: string; name: string; vaultId: string }
  > {
  readonly name = "devstation_vault_secret_generate" as const;
  readonly title = "Generate secret";
  readonly description =
    "Generates (or regenerates) an encrypted secret in a vault. The encryption key comes from the standing MCP session.";
  readonly risk = "mutating" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      vaultId: { type: "string" },
      name: { type: "string" },
      hostname: {
        type: "string",
        description: "Optional — defaults to the engine host's name.",
      },
      user: {
        type: "string",
        description: "Optional — defaults to the OS user running the engine.",
      },
      value: { type: "string" },
      description: { type: "string" },
    },
    required: ["vaultId", "name"],
    additionalProperties: false,
  };

  constructor(
    private readonly handler: GenerateSecretHandler,
    private readonly session: SessionResolver,
  ) {}

  async dispatch(
    args: Args,
  ): Promise<{ secretId: string; name: string; vaultId: string }> {
    const key = this.session.resolve();
    const actor = resolveActor(args);
    // Echo the new secretId so callers can chain without a `vault_secrets_list` + filter round-trip.
    const { secretId } = await this.handler.handle(
      new GenerateSecret(
        args.vaultId,
        args.name,
        key,
        actor.hostname,
        actor.user,
        args.value ?? null,
        args.description ?? null,
      ),
    );
    return { secretId, name: args.name, vaultId: args.vaultId };
  }
}
