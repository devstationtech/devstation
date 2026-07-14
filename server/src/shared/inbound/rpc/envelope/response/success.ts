import type { Id } from "@server/shared/inbound/rpc/envelope/id.ts";

export class Success<R> {
  readonly jsonrpc = "2.0" as const;

  private constructor(readonly id: Id, readonly result: R) {}

  static of<R>(id: Id, result: R): Success<R> {
    return new Success(id, result);
  }
}
