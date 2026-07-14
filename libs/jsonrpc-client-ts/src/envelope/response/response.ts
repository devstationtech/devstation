import type { Success } from "@jsonrpc-client-ts/envelope/response/success.ts";
import type { Failure } from "@jsonrpc-client-ts/envelope/response/failure.ts";

export type Response<R = unknown> = Success<R> | Failure;
