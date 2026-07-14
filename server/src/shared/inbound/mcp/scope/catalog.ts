/**
 * The catalogue of scopes an MCP access token can carry — owned by
 * the MCP context (the auth context treats scopes as opaque strings).
 *
 * Coarse, GitHub-PAT style: one read/write pair per context, plus the
 * cluster-only provisioning sub-scopes (plan / apply / destroy are
 * individually grantable). Per-feature granularity is a future
 * expansion.
 *
 * Grouped so the `/mcp` selection screen can render it directly; the
 * flat `ALL_MCP_SCOPES` is the validation set.
 */
export const MCP_SCOPE_CATALOG = [
  {
    context: "clusters",
    label: "Clusters",
    scopes: [
      "clusters:read",
      "clusters:write",
      "clusters:provision:plan",
      "clusters:provision:apply",
      "clusters:provision:destroy",
    ],
  },
  {
    context: "stations",
    label: "Stations",
    scopes: ["stations:read", "stations:write"],
  },
  {
    context: "vault",
    label: "Vault",
    scopes: ["vault:read", "vault:write"],
  },
  {
    context: "sizes",
    label: "Sizes",
    scopes: ["sizes:read", "sizes:write"],
  },
  {
    context: "images",
    label: "Images",
    scopes: ["images:read", "images:write"],
  },
  {
    context: "blueprints",
    label: "Blueprints",
    scopes: ["blueprints:read"],
  },
  {
    context: "executions",
    label: "Executions",
    scopes: ["executions:read", "executions:write"],
  },
] as const;

/** Every valid scope, flat — the validation set. */
export const ALL_MCP_SCOPES: readonly string[] = MCP_SCOPE_CATALOG.flatMap((g) => g.scopes);

/** True when `scope` is a known MCP scope. */
export function isMcpScope(scope: string): boolean {
  return ALL_MCP_SCOPES.includes(scope);
}
