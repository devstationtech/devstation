import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/rpc/endpoint/dispatch-context.ts";
import type {
  ClusterProxmoxImagesCreateRequest,
  ClusterProxmoxImagesCreateResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { ExecutionEventNotification } from "@jsonrpc-contracts-ts/executions.gen.ts";
import type { CreateImageHandler } from "@server/cluster/application/handlers/proxmox/create-image-handler.ts";
import { CreateImage } from "@server/cluster/application/commands/proxmox/create-image.ts";

/**
 * Endpoint `cluster.proxmox.images.create` — LSP-style. Thin inbound
 * adapter: delegates the use-case to `CreateImageHandler` (which
 * validates node credentials and starts the operation) and translates
 * the operation stream into wire notifications. Response is an empty
 * Ack — success is encoded by the absence of an error.
 */
export class CreateImageEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.images.create",
    ClusterProxmoxImagesCreateRequest,
    ClusterProxmoxImagesCreateResponse
  > {
  readonly method = "cluster.proxmox.images.create" as const;
  // Stays pending while the image materializes (download + qm import/
  // template), streaming progress — read-only w.r.t. persisted
  // aggregates, so the serve loop dispatches it concurrently.
  readonly streaming = true;

  constructor(private readonly handler: CreateImageHandler) {}

  async dispatch(
    request: ClusterProxmoxImagesCreateRequest,
    _session: unknown,
    ctx?: DispatchContext,
  ): Promise<ClusterProxmoxImagesCreateResponse> {
    const operation = await this.handler.handle(
      new CreateImage(request.clusterId, request.nodeId, request.imageId),
    );

    if (ctx) await ctx.notify("operation.started", { executionId: operation.id });

    for await (const event of operation.watch()) {
      if (event.type === "failed") throw new Error(event.error);
      if (event.type === "cancelled") throw new Error("cancelled");
      if (ctx) {
        await ctx.notify<ExecutionEventNotification>("execution.event", {
          executionId: operation.id,
          event,
        });
      }
    }

    return {};
  }
}
