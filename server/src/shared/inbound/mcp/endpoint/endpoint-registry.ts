import { PolicyViolation } from "@server/shared/inbound/mcp/policy/violation.ts";
import type { McpAuth } from "@server/shared/inbound/mcp/auth/mcp-auth.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { EndpointResult } from "@server/shared/inbound/mcp/endpoint/endpoint-result.ts";
import { validateArgs } from "@server/shared/inbound/mcp/endpoint/validate-args.ts";

// deno-lint-ignore no-explicit-any
type AnyEndpoint = Endpoint<string, any, any>;

interface Entry {
  readonly endpoint: AnyEndpoint;
  /** Scope this endpoint requires; `undefined` ⇒ always public. */
  readonly scope?: string;
}

/** Wraps a plain string in the wire-level `tools/call` result envelope. */
const text = (t: string): EndpointResult => ({
  content: [{ type: "text", text: t }],
});

/**
 * Routes MCP tool names to their `Endpoint` implementations. Two
 * registration paths declare intent at composition time:
 *
 *   .public(endpoint)         — always reachable (e.g. `rpc.version`).
 *   .protected(endpoint, sc)  — reachable only when the boot-time
 *                               `McpAuth` grants scope `sc`.
 *
 * With no access token configured, `McpAuth` grants nothing, so the
 * port is reachable only by its public endpoints — the read-only
 * surface expressed through scopes.
 *
 * `.call()` wraps the JSON-able result into the wire envelope and maps
 * `PolicyViolation` / generic errors to `isError: true`.
 */
export class EndpointRegistry {
  private readonly entries = new Map<string, Entry>();

  static empty(auth: McpAuth): EndpointRegistry {
    return new EndpointRegistry(auth);
  }

  private constructor(private readonly auth: McpAuth) {}

  /** Register an always-reachable endpoint. */
  public(endpoint: AnyEndpoint): this {
    this.add(endpoint, undefined);
    return this;
  }

  /** Register a scope-gated endpoint; reachable iff the token grants `scope`. */
  protected(endpoint: AnyEndpoint, scope: string): this {
    this.add(endpoint, scope);
    return this;
  }

  list(): Array<{
    name: string;
    title: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }> {
    return [...this.entries.values()]
      .filter((e) => this.reachable(e))
      .map(({ endpoint: e }) => ({
        name: e.name,
        title: e.title,
        description: `[${e.risk}] ${e.description}`,
        inputSchema: e.inputSchema,
      }));
  }

  async call(
    name: string,
    args: Record<string, unknown>,
    ctx: DispatchContext,
  ): Promise<EndpointResult> {
    const entry = this.entries.get(name);
    if (!entry) return { ...text(`unknown tool: ${name}`), isError: true };
    if (!this.reachable(entry)) {
      return {
        ...text(
          `tool '${name}' requires the '${entry.scope}' scope — generate an ` +
            `MCP access token that grants it (devstation → /mcp).`,
        ),
        isError: true,
      };
    }
    // Schema validation BEFORE dispatch. Without this gate, missing
    // required fields surface as opaque handler-internal errors
    // (e.g. "args.nodeIds is not iterable") and extra fields (e.g.
    // `skipTlsVerification` on endpoints that don't declare it) are
    // silently swallowed.
    const safeArgs = args ?? {};
    const validationError = validateArgs(
      safeArgs as Record<string, unknown>,
      entry.endpoint.inputSchema as Record<string, unknown>,
    );
    if (validationError) {
      return { ...text(`invalid args: ${validationError}`), isError: true };
    }
    try {
      const result = await entry.endpoint.dispatch(safeArgs, ctx);
      return text(JSON.stringify(result, null, 2));
    } catch (err) {
      const msg = err instanceof PolicyViolation
        ? err.message
        : err instanceof Error
        ? err.message
        : String(err);
      return { ...text(msg), isError: true };
    }
  }

  /** Public entries are always reachable; scoped ones need the grant. */
  private reachable(entry: Entry): boolean {
    return entry.scope === undefined || this.auth.grants(entry.scope);
  }

  private add(endpoint: AnyEndpoint, scope: string | undefined): void {
    if (this.entries.has(endpoint.name)) {
      throw new Error(`duplicate MCP endpoint: ${endpoint.name}`);
    }
    this.entries.set(endpoint.name, { endpoint, scope });
  }
}
