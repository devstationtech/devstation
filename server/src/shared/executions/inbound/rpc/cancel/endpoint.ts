import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ExecutionCancelRequest,
  ExecutionCancelResponse,
} from "@jsonrpc-contracts-ts/executions.gen.ts";
import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";

/**
 * Endpoint `operation.cancel` — best-effort cancellation (AIP-151).
 *
 * Returns immediately with an empty Ack — the actual terminal event
 * arrives as a `Cancelled` notification on any active `operation.watch`
 * for the same operationId.
 */
export class CancelEndpoint
  implements
    ProtectedEndpoint<"execution.cancel", ExecutionCancelRequest, ExecutionCancelResponse> {
  readonly method = "execution.cancel" as const;

  constructor(private readonly executions: Executions) {}

  async dispatch(request: ExecutionCancelRequest): Promise<ExecutionCancelResponse> {
    await this.executions.cancel(request.executionId);
    return {};
  }
}
