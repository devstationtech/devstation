import type { Id } from "@server/shared/inbound/rpc/envelope/id.ts";
import { ErrorCode } from "@server/shared/inbound/rpc/error/error-code.ts";
import { Unauthenticated } from "@server/shared/authentication/domain/exceptions/unauthenticated.ts";

interface ErrorBody {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

export class Failure {
  readonly jsonrpc = "2.0" as const;

  private constructor(readonly id: Id | null, readonly error: ErrorBody) {}

  static parseError(): Failure {
    return new Failure(null, { code: ErrorCode.PARSE_ERROR, message: "parse error" });
  }

  static invalidRequest(id: Id | null, detail: string): Failure {
    return new Failure(id, {
      code: ErrorCode.INVALID_REQUEST,
      message: `invalid request: ${detail}`,
    });
  }

  static methodNotFound(id: Id, method: string): Failure {
    return new Failure(id, {
      code: ErrorCode.METHOD_NOT_FOUND,
      message: `method not found: ${method}`,
    });
  }

  /**
   * Maps a backend exception to a JSON-RPC error envelope.
   *
   * Only shared/domain exceptions are translated here. BC-specific
   * exceptions surface as INTERNAL_ERROR with the original message
   * until a dedicated mapping is added.
   */
  static fromException(id: Id | null, error: unknown): Failure {
    if (error instanceof Unauthenticated) {
      return new Failure(id, {
        code: ErrorCode.UNAUTHENTICATED,
        message: "unauthenticated",
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    return new Failure(id, { code: ErrorCode.INTERNAL_ERROR, message });
  }
}
