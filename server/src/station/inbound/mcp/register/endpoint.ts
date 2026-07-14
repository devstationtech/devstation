import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { JsonSchema } from "@server/shared/inbound/mcp/json-schema.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { RegisterStationHandler } from "@server/station/application/handlers/register-station-handler.ts";
import { RegisterStation } from "@server/station/application/commands/register-station.ts";
import { resolveActor } from "@server/shared/inbound/mcp/actor.ts";
import { slugSchema } from "@server/shared/inbound/mcp/json-schema-slug.ts";

type Args = {
  name: string;
  description: string;
  user?: string;
  hostname?: string;
};

/**
 * MCP endpoint `devstation_station_register` — registers a new station in the
 * catalog. Policy guard uses the station name from the args directly (no id to
 * resolve yet).
 */
export class RegisterStationMcpEndpoint implements
  Endpoint<
    "devstation_station_register",
    Args,
    { stationId: string; name: string }
  > {
  readonly name = "devstation_station_register" as const;
  readonly title = "Register station";
  readonly description =
    "Registers a new station in the catalog; enforces policy prefix on the provided name.";
  readonly risk = "mutating" as const;
  readonly inputSchema: JsonSchema = {
    type: "object",
    properties: {
      name: slugSchema({
        description: "Station name. Lowercase slug — letters, digits and hyphens only " +
          "(must start and end with a letter or digit). Max 64 chars.",
      }),
      description: { type: "string" },
      user: {
        type: "string",
        description: "Optional — defaults to the OS user running the engine.",
      },
      hostname: {
        type: "string",
        description: "Optional — defaults to the engine host's name.",
      },
    },
    required: ["name", "description"],
    additionalProperties: false,
  };

  constructor(private readonly handler: RegisterStationHandler) {}

  async dispatch(
    args: Args,
    ctx: DispatchContext,
  ): Promise<{ stationId: string; name: string }> {
    ctx.policy.requirePrefix(args.name);
    const actor = resolveActor(args);
    // Return the server-generated id so the caller doesn't need a follow-up read.
    const { stationId } = await this.handler.handle(
      new RegisterStation(args.name, args.description, actor.user, actor.hostname),
    );
    return { stationId, name: args.name };
  }
}
