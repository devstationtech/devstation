import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ExecutionListRequest,
  ExecutionListResponse,
} from "@jsonrpc-contracts-ts/executions.gen.ts";
import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";

/**
 * Endpoint `operation.list` — snapshot of every tracked operation.
 *
 * Returns just the id. Future iterations may enrich with kind,
 * status, started_at, and metadata so a monitoring screen can render
 * rows without per-operation watch.
 */
export class ListEndpoint
  implements ProtectedEndpoint<"execution.list", ExecutionListRequest, ExecutionListResponse> {
  readonly method = "execution.list" as const;

  constructor(private readonly executions: Executions) {}

  dispatch(_request: ExecutionListRequest): ExecutionListResponse {
    return this.executions.all().map((op) => ({ id: op.id }));
  }
}
