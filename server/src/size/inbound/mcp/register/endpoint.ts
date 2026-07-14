import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { JsonSchema } from "@server/shared/inbound/mcp/json-schema.ts";
import type { RegisterSizeHandler } from "@server/size/application/handlers/register-size-handler.ts";
import { RegisterSize } from "@server/size/application/commands/register-size.ts";
import { resolveActor } from "@server/shared/inbound/mcp/actor.ts";
import { slugSchema } from "@server/shared/inbound/mcp/json-schema-slug.ts";

type Args = {
  name: string;
  provider: string;
  cpu: number;
  ram: number;
  disk: number;
  user?: string;
  hostname?: string;
};

/**
 * MCP endpoint `devstation_size_register` — registers a new VM
 * size (hardware profile). Handler-direct counterpart of
 * `size.register` RPC.
 */
export class RegisterSizeMcpEndpoint implements
  Endpoint<
    "devstation_size_register",
    Args,
    { sizeId: string; name: string }
  > {
  readonly name = "devstation_size_register" as const;
  readonly title = "Register size";
  readonly description =
    "Registers a new VM hardware size (cpu, ram, disk profile) for use when provisioning virtual machines.";
  readonly risk = "mutating" as const;
  readonly inputSchema: JsonSchema = {
    type: "object",
    properties: {
      name: slugSchema({
        description: "Size name. Lowercase slug — letters, digits and hyphens only " +
          "(must start and end with a letter or digit). Max 64 chars.",
      }),
      provider: { type: "string" },
      cpu: { type: "number" },
      ram: { type: "number" },
      disk: { type: "number" },
      user: {
        type: "string",
        description: "Optional — defaults to the OS user running the engine.",
      },
      hostname: {
        type: "string",
        description: "Optional — defaults to the engine host's name.",
      },
    },
    required: ["name", "provider", "cpu", "ram", "disk"],
    additionalProperties: false,
  };

  constructor(private readonly handler: RegisterSizeHandler) {}

  async dispatch(args: Args): Promise<{ sizeId: string; name: string }> {
    const actor = resolveActor(args);
    // Return the server-generated id so callers don't need a list round-trip.
    const { sizeId } = await this.handler.handle(
      new RegisterSize(
        args.name,
        args.provider,
        args.cpu,
        args.ram,
        args.disk,
        actor.user,
        actor.hostname,
      ),
    );
    return { sizeId, name: args.name };
  }
}
