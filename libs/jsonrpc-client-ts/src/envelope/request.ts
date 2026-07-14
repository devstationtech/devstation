import type { Id } from "@jsonrpc-client-ts/envelope/id.ts";

export interface Request<M extends string = string, P = unknown> {
  readonly jsonrpc: "2.0";
  readonly id: Id;
  readonly method: M;
  readonly params: P;
}
