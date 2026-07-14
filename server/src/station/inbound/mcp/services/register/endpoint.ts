import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { RegisterServiceHandler } from "@server/station/application/handlers/register-service-handler.ts";
import { RegisterService } from "@server/station/application/commands/register-service.ts";
import type { Query as StationByIdQuery } from "@server/station/application/queries/by-id/query.ts";
import type { InputValue } from "@server/station/domain/models/service/inputs.ts";
import { resolveActor } from "@server/shared/inbound/mcp/actor.ts";
import { StationNotFound } from "@server/station/domain/exceptions/station-not-found.ts";

type InstanceArg = {
  role: string;
  host: string;
  credentialVaultId: string;
  usernameSecretId: string;
  passwordSecretId: string;
};

type HostArg = {
  serviceId: string;
  role: string;
};

type Args = {
  stationId: string;
  name: string;
  blueprint: string;
  vaultId: string;
  inputs: Record<string, InputValue>;
  secrets: Record<string, string>;
  user?: string;
  hostname?: string;
  instances?: InstanceArg[];
  host?: HostArg;
};

/**
 * MCP endpoint `devstation_station_service_register` — registers a service
 * inside an existing station. Policy guard resolves the station name via
 * StationByIdQuery and calls `policy.requirePrefix(name)`.
 */
export class RegisterServiceMcpEndpoint
  implements Endpoint<"devstation_station_service_register", Args, Record<string, never>> {
  readonly name = "devstation_station_service_register" as const;
  readonly title = "Register service";
  readonly description =
    "Registers a service inside a station; enforces policy prefix on the resolved station name.";
  readonly risk = "mutating" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      stationId: { type: "string" },
      name: { type: "string" },
      blueprint: { type: "string" },
      vaultId: { type: "string" },
      inputs: { type: "object", additionalProperties: {} },
      secrets: { type: "object", additionalProperties: { type: "string" } },
      user: {
        type: "string",
        description: "Optional — defaults to the OS user running the engine.",
      },
      hostname: {
        type: "string",
        description: "Optional — defaults to the engine host's name.",
      },
      instances: {
        type: "array",
        items: {
          type: "object",
          properties: {
            role: { type: "string" },
            host: { type: "string" },
            credentialVaultId: { type: "string" },
            usernameSecretId: { type: "string" },
            passwordSecretId: { type: "string" },
          },
          required: ["role", "host", "credentialVaultId", "usernameSecretId", "passwordSecretId"],
          additionalProperties: false,
        },
      },
      host: {
        type: "object",
        properties: {
          serviceId: { type: "string" },
          role: { type: "string" },
        },
        required: ["serviceId", "role"],
        additionalProperties: false,
      },
    },
    required: [
      "stationId",
      "name",
      "blueprint",
      "vaultId",
      "inputs",
      "secrets",
    ],
    additionalProperties: false,
  };

  constructor(
    private readonly handler: RegisterServiceHandler,
    private readonly stationById: StationByIdQuery,
  ) {}

  async dispatch(args: Args, ctx: DispatchContext): Promise<Record<string, never>> {
    const station = await this.stationById.execute(args.stationId);
    if (!station) throw new StationNotFound();
    ctx.policy.requirePrefix(station.name);
    const actor = resolveActor(args);
    await this.handler.handle(
      new RegisterService(
        args.stationId,
        args.name,
        args.blueprint,
        args.vaultId,
        { ...args.inputs },
        { ...args.secrets },
        actor.user,
        actor.hostname,
        args.instances ? args.instances.map((i) => ({ ...i })) : null,
        args.host ? { ...args.host } : null,
      ),
    );
    return {};
  }
}
