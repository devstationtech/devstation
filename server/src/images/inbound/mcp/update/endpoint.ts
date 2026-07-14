import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { JsonSchema } from "@server/shared/inbound/mcp/json-schema.ts";
import type { UpdateImageHandler } from "@server/images/application/handlers/update-image-handler.ts";
import { UpdateImage } from "@server/images/application/commands/update-image.ts";

type Args = { id: string; name: string; os: string; sourceUrl: string };

/**
 * MCP endpoint `devstation_image_update` — updates a catalog image.
 * Handler-direct counterpart of `image.update` RPC.
 */
export class UpdateImageMcpEndpoint
  implements Endpoint<"devstation_image_update", Args, Record<string, never>> {
  readonly name = "devstation_image_update" as const;
  readonly title = "Update image";
  readonly description = "Updates a catalog image's name, OS and source URL.";
  readonly risk = "mutating" as const;
  readonly inputSchema: JsonSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      os: { type: "string", enum: ["ubuntu-22-04", "ubuntu-24-04", "debian-12"] },
      sourceUrl: { type: "string" },
    },
    required: ["id", "name", "os", "sourceUrl"],
    additionalProperties: false,
  };

  constructor(private readonly handler: UpdateImageHandler) {}

  async dispatch(args: Args): Promise<Record<string, never>> {
    await this.handler.handle(new UpdateImage(args.id, args.name, args.os, args.sourceUrl));
    return {};
  }
}
