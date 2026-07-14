import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { UnregisterImageHandler } from "@server/images/application/handlers/unregister-image-handler.ts";
import { UnregisterImage } from "@server/images/application/commands/unregister-image.ts";

type Args = { id: string };

/**
 * MCP endpoint `devstation_image_unregister` — unregisters a catalog image.
 * Handler-direct counterpart of `image.unregister` RPC.
 */
export class UnregisterImageMcpEndpoint
  implements Endpoint<"devstation_image_unregister", Args, Record<string, never>> {
  readonly name = "devstation_image_unregister" as const;
  readonly title = "Unregister image";
  readonly description = "Unregisters an image from the catalog.";
  readonly risk = "destructive" as const;
  readonly inputSchema = {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
    additionalProperties: false,
  };

  constructor(private readonly handler: UnregisterImageHandler) {}

  async dispatch(args: Args): Promise<Record<string, never>> {
    await this.handler.handle(new UnregisterImage(args.id));
    return {};
  }
}
