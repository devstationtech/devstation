import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { JsonSchema } from "@server/shared/inbound/mcp/json-schema.ts";
import type { RegisterImageHandler } from "@server/images/application/handlers/register-image-handler.ts";
import { RegisterImage } from "@server/images/application/commands/register-image.ts";
import { resolveActor } from "@server/shared/inbound/mcp/actor.ts";
import { slugSchema } from "@server/shared/inbound/mcp/json-schema-slug.ts";

type Args = {
  name: string;
  os: string;
  sourceUrl: string;
  user?: string;
  hostname?: string;
};

/**
 * MCP endpoint `devstation_image_register` — adds an OS image to the catalog.
 * Handler-direct counterpart of `image.register` RPC.
 */
export class RegisterImageMcpEndpoint
  implements Endpoint<"devstation_image_register", Args, { imageId: string; name: string }> {
  readonly name = "devstation_image_register" as const;
  readonly title = "Register image";
  readonly description =
    "Adds a bootable OS image (name, os, ISO/cloud-image url) to the central catalog.";
  readonly risk = "mutating" as const;
  readonly inputSchema: JsonSchema = {
    type: "object",
    properties: {
      name: slugSchema({
        description: "Image name. Lowercase slug — letters, digits and hyphens only. Max 64 chars.",
      }),
      os: { type: "string", enum: ["ubuntu-22-04", "ubuntu-24-04", "debian-12", "debian-13"] },
      sourceUrl: { type: "string", description: "ISO / cloud-image download URL (http/https)." },
      user: {
        type: "string",
        description: "Optional — defaults to the OS user running the engine.",
      },
      hostname: { type: "string", description: "Optional — defaults to the engine host's name." },
    },
    required: ["name", "os", "sourceUrl"],
    additionalProperties: false,
  };

  constructor(private readonly handler: RegisterImageHandler) {}

  async dispatch(args: Args): Promise<{ imageId: string; name: string }> {
    const actor = resolveActor(args);
    const { imageId } = await this.handler.handle(
      new RegisterImage(args.name, args.os, args.sourceUrl, actor.user, actor.hostname),
    );
    return { imageId, name: args.name };
  }
}
