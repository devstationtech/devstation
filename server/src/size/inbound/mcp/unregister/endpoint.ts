import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { UnregisterSizeHandler } from "@server/size/application/handlers/unregister-size-handler.ts";
import { UnregisterSize } from "@server/size/application/commands/unregister-size.ts";

type Args = {
  sizeId: string;
};

/**
 * MCP endpoint `devstation_size_unregister` — permanently removes
 * a VM size. Handler-direct counterpart of `size.unregister`
 * RPC.
 */
export class UnregisterSizeMcpEndpoint
  implements Endpoint<"devstation_size_unregister", Args, Record<string, never>> {
  readonly name = "devstation_size_unregister" as const;
  readonly title = "Unregister size";
  readonly description = "Permanently removes a VM hardware size.";
  readonly risk = "destructive" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      sizeId: { type: "string" },
    },
    required: ["sizeId"],
    additionalProperties: false,
  };

  constructor(private readonly handler: UnregisterSizeHandler) {}

  async dispatch(args: Args): Promise<Record<string, never>> {
    await this.handler.handle(new UnregisterSize(args.sizeId));
    return {};
  }
}
