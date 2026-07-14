import type { Id } from "@jsonrpc-client-ts/envelope/id.ts";

/** Envelope of a failed method call. UI reads these and the Client turns them into Exception. */
export interface Failure {
  readonly jsonrpc: "2.0";
  readonly id: Id | null;
  readonly error: {
    readonly code: number;
    readonly message: string;
    readonly data?: unknown;
  };
}
