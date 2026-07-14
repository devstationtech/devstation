import type { Id } from "@jsonrpc-client-ts/envelope/id.ts";

/** Envelope of a successful method call. UI never builds these, only reads them off the wire. */
export interface Success<R = unknown> {
  readonly jsonrpc: "2.0";
  readonly id: Id;
  readonly result: R;
}
