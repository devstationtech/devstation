/**
 * JSON-RPC 2.0 error codes — UI-side mirror of the wire contract.
 *
 * The server keeps its own copy at `src/shared/inbound/rpc/error/`. Both
 * sides agree on the numeric codes; there is no shared TS import — the
 * wire is the contract.
 */
export enum ErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,

  UNAUTHENTICATED = -32000,
  RESOURCE_NOT_FOUND = -32001,
  CONFLICT = -32002,
}
