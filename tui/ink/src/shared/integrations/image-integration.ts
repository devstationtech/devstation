import type {
  ImageListRequest,
  ImageListResponse,
  ImageRegisterRequest,
  ImageRegisterResponse,
  ImageUnregisterRequest,
  ImageUnregisterResponse,
  ImageUpdateRequest,
  ImageUpdateResponse,
} from "@jsonrpc-contracts-ts/image.gen.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";

/**
 * Integration for the `image.*` RPC surface — the central image catalog
 * (its own bounded context). Catalog CRUD lives here; assigning a catalog
 * image to a cluster node stays on the cluster surface (`cluster.proxmox
 * .images.assign`), carrying a point-in-time snapshot.
 *
 * Every method is protected — the caller must include a valid sessionId.
 */
export class ImageIntegration {
  constructor(private readonly rpc: Client) {}

  register(request: ImageRegisterRequest): Promise<ImageRegisterResponse> {
    return this.rpc.invoke<ImageRegisterResponse>("image.register", request);
  }

  update(request: ImageUpdateRequest): Promise<ImageUpdateResponse> {
    return this.rpc.invoke<ImageUpdateResponse>("image.update", request);
  }

  unregister(request: ImageUnregisterRequest): Promise<ImageUnregisterResponse> {
    return this.rpc.invoke<ImageUnregisterResponse>("image.unregister", request);
  }

  list(request: ImageListRequest): Promise<ImageListResponse> {
    return this.rpc.invoke<ImageListResponse>("image.list", request);
  }
}
