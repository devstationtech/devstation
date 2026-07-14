/**
 * The scope menu offered by the `/mcp` screen — a presentation list,
 * GitHub-PAT style: one read/write pair per context plus the cluster-only
 * provisioning sub-scopes.
 *
 * The server is the source of truth for *validation* (it rejects unknown
 * scopes when minting a token); this UI-side catalogue just decides what
 * checkboxes to draw, mirroring `src/shared/inbound/mcp/scope/catalog.ts`.
 * If the two drift, the server fails safe by refusing the unknown scope.
 */
export type ScopeOption = {
  readonly scope: string;
  readonly label: string;
  readonly description: string;
};

export type ScopeGroup = {
  readonly label: string;
  readonly scopes: readonly ScopeOption[];
};

export const MCP_SCOPE_GROUPS: readonly ScopeGroup[] = [
  {
    label: "Clusters",
    scopes: [
      {
        scope: "clusters:read",
        label: "read",
        description: "View clusters, nodes and VMs",
      },
      {
        scope: "clusters:write",
        label: "write",
        description: "Register and update clusters, nodes and VMs",
      },
      {
        scope: "clusters:provision:plan",
        label: "provision:plan",
        description: "Preview provisioning (plan)",
      },
      {
        scope: "clusters:provision:apply",
        label: "provision:apply",
        description: "Provision infrastructure (apply)",
      },
      {
        scope: "clusters:provision:destroy",
        label: "provision:destroy",
        description: "Tear down infrastructure (destroy)",
      },
    ],
  },
  {
    label: "Stations",
    scopes: [
      { scope: "stations:read", label: "read", description: "View stations and services" },
      {
        scope: "stations:write",
        label: "write",
        description: "Register, update and install stations and services",
      },
    ],
  },
  {
    label: "Vault",
    scopes: [
      { scope: "vault:read", label: "read", description: "List vaults and secret metadata" },
      {
        scope: "vault:write",
        label: "write",
        description: "Create/remove vaults, generate and remove secrets",
      },
    ],
  },
  {
    label: "Sizing",
    scopes: [
      { scope: "sizes:read", label: "read", description: "List instance sizes" },
      {
        scope: "sizes:write",
        label: "write",
        description: "Register and unregister instance sizes",
      },
    ],
  },
  {
    label: "Images",
    scopes: [
      { scope: "images:read", label: "read", description: "List the OS image catalog" },
      {
        scope: "images:write",
        label: "write",
        description: "Register, update and remove catalog images",
      },
    ],
  },
  {
    label: "Blueprints",
    scopes: [
      { scope: "blueprints:read", label: "read", description: "Browse the blueprint catalog" },
    ],
  },
  {
    label: "Executions",
    scopes: [
      { scope: "executions:read", label: "read", description: "Watch and list executions" },
      { scope: "executions:write", label: "write", description: "Cancel running executions" },
    ],
  },
];

/** Every scope in the catalogue, flattened. */
export const ALL_SCOPE_OPTIONS: readonly ScopeOption[] = MCP_SCOPE_GROUPS.flatMap(
  (g) => g.scopes,
);
