import type { Endpoint } from "@server/shared/inbound/rpc/endpoint/endpoint.ts";
import type {
  BlueprintValidateRequest,
  BlueprintValidateResponse,
} from "@jsonrpc-contracts-ts/blueprint.gen.ts";
import type { Query as ValidateBlueprintQuery } from "@server/blueprint/application/queries/validate/query.ts";

/**
 * Endpoint `blueprint.validate` — validates a candidate blueprint at a
 * local path with the real parser and reports name collisions.
 *
 * Public (no session): read-only, returns only pass/fail + name + a
 * collision hint. Thin inbound boundary over the existing query.
 */
export class ValidateBlueprintEndpoint
  implements Endpoint<"blueprint.validate", BlueprintValidateRequest, BlueprintValidateResponse> {
  readonly method = "blueprint.validate" as const;

  constructor(private readonly query: ValidateBlueprintQuery) {}

  dispatch(request: BlueprintValidateRequest): Promise<BlueprintValidateResponse> {
    return this.query.execute(request.path);
  }
}
