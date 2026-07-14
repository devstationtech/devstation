import type { Success } from "@server/shared/inbound/rpc/envelope/response/success.ts";
import type { Failure } from "@server/shared/inbound/rpc/envelope/response/failure.ts";

export type Response<R = unknown> = Success<R> | Failure;
