/**
 * Scope-aware auth state for the MCP port.
 *
 * Built at boot from the access token loaded from `~/.devstation/
 * mcp/token.json`: it carries the set of scopes that token grants. No token
 * (or an expired one) ⇒ `McpAuth.none()` — an empty scope set, which
 * leaves only the always-public endpoints reachable (the read-only surface).
 */
export class McpAuth {
  private constructor(private readonly scopes: ReadonlySet<string>) {}

  /** Auth carrying exactly the given scopes (from a loaded token). */
  static of(scopes: Iterable<string>): McpAuth {
    return new McpAuth(new Set(scopes));
  }

  /** No token configured — grants nothing. */
  static none(): McpAuth {
    return new McpAuth(new Set());
  }

  /** True when a `.protected()` endpoint requiring `scope` is reachable. */
  grants(scope: string): boolean {
    return this.scopes.has(scope);
  }

  /** The granted scopes, for diagnostics. */
  get granted(): readonly string[] {
    return [...this.scopes].sort();
  }
}
