/**
 * MCP resource — read-only URI surface. The MCP SDK calls
 * `resources/list` and `resources/read`; each `Resource` answers one
 * `devstation://…` URI.
 *
 * Resources are the read-only counterpart to `endpoint/Endpoint` (the
 * `tools/call` surface). They live per-BC just like endpoints; the
 * resource owns its query and dispatches handler-direct.
 */
export interface Resource {
  readonly uri: string;
  readonly name: string;
  readonly description: string;
  /** Returns a JSON-able value; the registry wraps it in the wire envelope. */
  read(): Promise<unknown> | unknown;
}
