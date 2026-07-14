/**
 * JSON-RPC 2.0 error codes — wire contract shared by server and clients.
 *
 * Standard range: -32768..-32000 (reserved by the JSON-RPC spec).
 * Domain range:   -32000..-32099 (server-defined).
 *
 * The UI side keeps its own copy of this enum (`cli/ui/rpc-client/error/`)
 * because the wire codes are the contract, not TS code — UI and server
 * agree on numbers, not imports.
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
