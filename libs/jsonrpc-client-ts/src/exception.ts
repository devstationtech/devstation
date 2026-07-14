import type { Failure } from "@jsonrpc-client-ts/envelope/response/failure.ts";
import { ErrorCode } from "@jsonrpc-client-ts/error/error-code.ts";

/**
 * UI-side exception raised when the server returns an error envelope.
 *
 * Carries the numeric JSON-RPC error code so the UI can branch on it
 * (`error.code === ErrorCode.UNAUTHENTICATED`) without importing any
 * backend exception class. The wire is the contract.
 */
export class Exception extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "Exception";
  }

  static from(response: Failure): Exception {
    return new Exception(response.error.code, response.error.message, response.error.data);
  }

  isUnauthenticated(): boolean {
    return this.code === ErrorCode.UNAUTHENTICATED;
  }
}
