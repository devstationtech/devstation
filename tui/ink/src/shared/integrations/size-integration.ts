import type {
  SizeListRequest,
  SizeListResponse,
  SizeRegisterRequest,
  SizeRegisterResponse,
  SizeUnregisterRequest,
  SizeUnregisterResponse,
} from "@jsonrpc-contracts-ts/size.gen.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";

/**
 * Integration for the `size.*` RPC surface.
 *
 * Every method is protected — the caller must include a valid sessionId in
 * the Request. The endpoint resolves the session at the wire boundary.
 */
export class SizeIntegration {
  constructor(private readonly rpc: Client) {}

  register(request: SizeRegisterRequest): Promise<SizeRegisterResponse> {
    return this.rpc.invoke<SizeRegisterResponse>("size.register", request);
  }

  unregister(request: SizeUnregisterRequest): Promise<SizeUnregisterResponse> {
    return this.rpc.invoke<SizeUnregisterResponse>("size.unregister", request);
  }

  list(request: SizeListRequest): Promise<SizeListResponse> {
    return this.rpc.invoke<SizeListResponse>("size.list", request);
  }
}
