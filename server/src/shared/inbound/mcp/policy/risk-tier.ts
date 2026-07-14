/**
 * Risk classification an MCP tool/endpoint declares so the registry
 * can tag its description and the optional policy can gate it.
 *
 *   read         — pure read (resolves an id, lists, gets).
 *   mutating     — write that mutates state but is reversible (register,
 *                  update, tag).
 *   destructive  — irreversible write (unregister, destroy, delete).
 *   long-running — fire-and-watch (apply, install) — returns executionId
 *                  and emits notifications until terminal event.
 */
export type RiskTier = "read" | "mutating" | "destructive" | "long-running";
