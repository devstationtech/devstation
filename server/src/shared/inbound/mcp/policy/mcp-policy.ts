import { PolicyViolation } from "@server/shared/inbound/mcp/policy/violation.ts";

/**
 * Optional server-side safety policy. Default = OFF (full feature
 * exposure). The harness opts in for test runs; production users can
 * opt in as defense-in-depth.
 *
 *   DEVSTATION_MCP_POLICY=prefix:ds-e2e-,allow:homelab
 *
 * Grammar: comma-separated `key:value` pairs. Keys:
 *   - `prefix`  — destructive ops require the target name to start with this
 *                 (repeat the key to allow multiple prefixes)
 *   - `allow`   — explicit cluster-name allowlist that widens past the prefix
 *                 (repeat to allow multiple)
 *
 * Unknown keys are ignored (forward-compat).
 *
 * Behaviour lives on the class — `requireMutableCluster` /
 * `requirePrefix` are instance methods so the policy and its checks
 * travel together (OO over free functions).
 */
export class McpPolicy {
  constructor(
    readonly prefixes: readonly string[],
    readonly allowClusters: readonly string[],
  ) {}

  /** Sentinel for "no policy" — full feature exposure. Singleton. */
  static readonly OFF: McpPolicy = new McpPolicy([], []);

  /**
   * Parses the env-shaped string `prefix:…,allow:…`. Empty / blank
   * returns `McpPolicy.OFF`. Unknown keys are ignored (forward-compat).
   * The raw string is read from env by the composition root (`src/mcp.ts`)
   * — this layer must not touch env directly (arch boundary).
   */
  static load(raw: string): McpPolicy {
    if (!raw.trim()) return McpPolicy.OFF;
    const prefixes: string[] = [];
    const allowClusters: string[] = [];
    for (const part of raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0)) {
      const colon = part.indexOf(":");
      if (colon < 0) continue;
      const k = part.slice(0, colon).trim();
      const v = part.slice(colon + 1).trim();
      if (!v) continue;
      if (k === "prefix") prefixes.push(v);
      else if (k === "allow") allowClusters.push(v);
      // unknown keys ignored — forward-compat
    }
    return new McpPolicy(prefixes, allowClusters);
  }

  /** True when no prefix is configured — every check becomes a no-op. */
  get off(): boolean {
    return this.prefixes.length === 0;
  }

  /**
   * Destructive guard for an EXISTING cluster (apply/destroy/image-create/
   * install). No-op when policy is off. Passes when the cluster name is
   * in the allowlist; otherwise delegates to `requirePrefix`.
   */
  requireMutableCluster(clusterName: string | undefined): void {
    if (this.off) return;
    if (clusterName && this.allowClusters.includes(clusterName)) return;
    this.requirePrefix(clusterName);
  }

  /**
   * Requires at least one of the resolved identities to start with one
   * of the configured prefixes. No-op when policy is off. Identities
   * must be the *resolved* human name(s)/tag(s) — never a raw id (the
   * caller must read first to resolve the human-readable name).
   */
  requirePrefix(...identities: ReadonlyArray<string | undefined>): void {
    if (this.off) return;
    const known = identities.filter((v): v is string => !!v && v.length > 0);
    if (known.length === 0) {
      throw new PolicyViolation(
        "refused: target identity could not be resolved for policy prefix check " +
          "(resolve the resource via a read tool first).",
      );
    }
    const ok = known.some((id) => this.prefixes.some((p) => id.startsWith(p)));
    if (!ok) {
      throw new PolicyViolation(
        `refused: target [${known.join(", ")}] does not carry any of the configured ` +
          `policy prefixes [${this.prefixes.join(", ")}].`,
      );
    }
  }
}
