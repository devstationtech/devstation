import type {
  BlueprintByIdRequest,
  BlueprintByIdResponse,
  BlueprintListRequest,
  BlueprintListResponse,
} from "@jsonrpc-contracts-ts/blueprint.gen.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";

/**
 * Integration for the `blueprint.*` RPC surface (read-only catalog).
 *
 * Every method is protected — the caller must include a valid sessionId
 * in the Request. The endpoint resolves the session at the wire boundary.
 */
export class BlueprintIntegration {
  constructor(private readonly rpc: Client) {}

  list(request: BlueprintListRequest): Promise<BlueprintListResponse> {
    return this.rpc.invoke<BlueprintListResponse>("blueprint.list", request);
  }

  byId(request: BlueprintByIdRequest): Promise<BlueprintByIdResponse> {
    return this.rpc.invoke<BlueprintByIdResponse>("blueprint.byId", request);
  }
}
