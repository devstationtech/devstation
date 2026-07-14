/**
 * MCP composition root + entry point.
 *
 * `bootMcpServer()` is the async composition: it loads the MCP access
 * token (`~/.devstation/mcp/token.json`), derives the scope-aware `McpAuth`,
 * installs the token's vault key as a standing session so in-process
 * secret resolution works, wires the per-BC endpoints/resources, and
 * returns the composed SDK server + its boot banner.
 *
 * Boot is async (unlike `rpc.ts`'s sync `rpc` const) because the token
 * lives in a file — an inherent difference, not an accidental one.
 * Both run paths — `import.meta.main` here and the `devstation mcp
 * serve` subcommand — call `bootMcpServer()` then `serveStdio`.
 *
 * Importing this module has NO side effects (no token read, no session
 * install): all of that is inside `bootMcpServer()`, so the TUI (which
 * imports this for the subcommand) is unaffected.
 */
import type { Server as McpSdkServer } from "@modelcontextprotocol/sdk/server/index.js";
import { container } from "@server/dependencies.ts";
import { MCP_POLICY } from "@server/env.ts";
import { McpPolicy } from "@server/shared/inbound/mcp/policy/mcp-policy.ts";
import { McpAuth } from "@server/shared/inbound/mcp/auth/mcp-auth.ts";
import { EndpointRegistry } from "@server/shared/inbound/mcp/endpoint/endpoint-registry.ts";
import { ResourceRegistry } from "@server/shared/inbound/mcp/resource/resource-registry.ts";
import { buildMcpServer, serveStdio } from "@server/shared/inbound/mcp/server.ts";
import { LoadAccessTokenHandler } from "@server/auth/application/handlers/load-access-token-handler.ts";
import { KeyWrapAdapter } from "@server/auth/outbound/key-wrap-adapter.ts";
import { SessionsAdapter } from "@server/auth/outbound/sessions-adapter.ts";
import { Session } from "@server/auth/domain/models/session.ts";
import {
  AcknowledgeInterruptionMcpEndpoint,
  ApplyNodesMcpEndpoint,
  AssignImageMcpEndpoint,
  BootstrapKeyMcpEndpoint,
  ClusterByIdMcpEndpoint,
  ClustersResource,
  ConnectClusterMcpEndpoint,
  CreateImageMcpEndpoint,
  DestroyNodesMcpEndpoint,
  DisconnectClusterMcpEndpoint,
  ListClustersMcpEndpoint,
  ListImagesMcpEndpoint,
  ListOperatingSystemsMcpEndpoint,
  ListProvidersMcpEndpoint,
  ListProxmoxConnectionsMcpEndpoint,
  ListProxmoxNodesMcpEndpoint,
  ListProxmoxVirtualMachinesMcpEndpoint,
  ListVirtualMachineTagsMcpEndpoint,
  PlanNodesMcpEndpoint,
  ProvisionPreviewMcpEndpoint,
  RegisterClusterMcpEndpoint,
  RegisterNodeMcpEndpoint,
  RegisterVirtualMachineMcpEndpoint,
  StorageByNodeMcpEndpoint,
  TestProxmoxConnectionMcpEndpoint,
  UnassignImageMcpEndpoint,
  UnregisterAllNodesMcpEndpoint,
  UnregisterAllVirtualMachinesMcpEndpoint,
  UnregisterClusterMcpEndpoint,
  UnregisterNodeMcpEndpoint,
  UnregisterVirtualMachineMcpEndpoint,
  UpdateAssignedImageMcpEndpoint,
  UpdateNodeMcpEndpoint,
  UpdateVirtualMachineMcpEndpoint,
  VirtualMachineByImageMcpEndpoint,
  VirtualMachineMetricsMcpEndpoint,
} from "@server/cluster/inbound/mcp/endpoints.ts";
import {
  InstallStationMcpEndpoint,
  ListInstancesMcpEndpoint,
  ListServicesMcpEndpoint,
  ListStationsMcpEndpoint,
  RegisterServiceMcpEndpoint,
  RegisterStationMcpEndpoint,
  ServiceByIdMcpEndpoint,
  ServicesByBlueprintMcpEndpoint,
  ServicesByStationMcpEndpoint,
  ServicesResource,
  StationByIdMcpEndpoint,
  StationsResource,
  UninstallStationMcpEndpoint,
  UnregisterServiceMcpEndpoint,
  UnregisterStationMcpEndpoint,
  UpdateStationMcpEndpoint,
} from "@server/station/inbound/mcp/endpoints.ts";
import {
  BlueprintByIdMcpEndpoint,
  BlueprintsResource,
  ListBlueprintsMcpEndpoint,
} from "@server/blueprint/inbound/mcp/endpoints.ts";
import {
  CreateVaultMcpEndpoint,
  DeleteSecretMcpEndpoint,
  DeleteVaultMcpEndpoint,
  GenerateSecretMcpEndpoint,
  ListSecretsMcpEndpoint,
  ListVaultsMcpEndpoint,
  RenameSecretMcpEndpoint,
  RenameVaultMcpEndpoint,
} from "@server/vault/inbound/mcp/endpoints.ts";
import {
  ListSizesMcpEndpoint,
  RegisterSizeMcpEndpoint,
  UnregisterSizeMcpEndpoint,
} from "@server/size/inbound/mcp/endpoints.ts";
import {
  ListImagesMcpEndpoint as CatalogListImagesMcpEndpoint,
  RegisterImageMcpEndpoint as CatalogRegisterImageMcpEndpoint,
  UnregisterImageMcpEndpoint as CatalogUnregisterImageMcpEndpoint,
  UpdateImageMcpEndpoint as CatalogUpdateImageMcpEndpoint,
} from "@server/images/inbound/mcp/endpoints.ts";
import {
  CancelExecutionMcpEndpoint,
  ExecutionsResource,
  ListExecutionsMcpEndpoint,
  WatchExecutionMcpEndpoint,
} from "@server/shared/executions/inbound/mcp/endpoints.ts";
import { RpcVersionMcpEndpoint } from "@server/shared/inbound/mcp/rpc-version/endpoint.ts";

/** Env-loaded safety policy. Default = OFF (full feature exposure). */
export const policy = McpPolicy.load(MCP_POLICY);

/**
 * Loads the access token, derives the scope-aware auth, and — when a
 * token is present — installs its vault key as a standing session so
 * `SecretResolver` works without a login. Mutates the process's
 * session store; only ever called at serve time.
 */
async function authorize(): Promise<McpAuth> {
  const token = await container.get(LoadAccessTokenHandler).handle();
  if (!token) return McpAuth.none();
  const key = await container.get(KeyWrapAdapter).unwrap(token.wrappedKey);
  container.get(SessionsAdapter).save(Session.standing(key, token.expiresAt));
  return McpAuth.of(token.scopes.map((s) => s.value));
}

/** Per-BC MCP resource registry (read-only `devstation://…` surface). */
function buildResources(): ResourceRegistry {
  return ResourceRegistry.empty()
    .register(container.get(ClustersResource))
    .register(container.get(StationsResource))
    .register(container.get(ServicesResource))
    .register(container.get(BlueprintsResource))
    .register(container.get(ExecutionsResource));
}

/**
 * Per-BC MCP endpoint registry. `.public()` = always reachable;
 * `.protected(endpoint, scope)` = reachable only when the token grants
 * `scope`. The endpoint → scope map lives here (the MCP context owns
 * the scope catalogue).
 */
function buildEndpoints(auth: McpAuth): EndpointRegistry {
  return EndpointRegistry.empty(auth)
    // handshake
    .public(container.get(RpcVersionMcpEndpoint))
    // Cluster — reads
    .protected(container.get(ListClustersMcpEndpoint), "clusters:read")
    .protected(container.get(ClusterByIdMcpEndpoint), "clusters:read")
    .protected(container.get(ListProxmoxNodesMcpEndpoint), "clusters:read")
    .protected(container.get(ListProxmoxVirtualMachinesMcpEndpoint), "clusters:read")
    .protected(container.get(ListVirtualMachineTagsMcpEndpoint), "clusters:read")
    .protected(container.get(ListProvidersMcpEndpoint), "clusters:read")
    .protected(container.get(ListOperatingSystemsMcpEndpoint), "clusters:read")
    .protected(container.get(ListProxmoxConnectionsMcpEndpoint), "clusters:read")
    .protected(container.get(ListImagesMcpEndpoint), "clusters:read")
    .protected(container.get(ProvisionPreviewMcpEndpoint), "clusters:read")
    .protected(container.get(VirtualMachineByImageMcpEndpoint), "clusters:read")
    .protected(container.get(VirtualMachineMetricsMcpEndpoint), "clusters:read")
    .protected(container.get(StorageByNodeMcpEndpoint), "clusters:read")
    .protected(container.get(TestProxmoxConnectionMcpEndpoint), "clusters:read")
    .protected(container.get(BootstrapKeyMcpEndpoint), "clusters:write")
    // Cluster — writes (mutate the aggregate, not a provisioning run)
    .protected(container.get(AcknowledgeInterruptionMcpEndpoint), "clusters:write")
    .protected(container.get(CreateImageMcpEndpoint), "clusters:write")
    .protected(container.get(RegisterNodeMcpEndpoint), "clusters:write")
    .protected(container.get(RegisterVirtualMachineMcpEndpoint), "clusters:write")
    .protected(container.get(RegisterClusterMcpEndpoint), "clusters:write")
    .protected(container.get(UnregisterClusterMcpEndpoint), "clusters:write")
    .protected(container.get(ConnectClusterMcpEndpoint), "clusters:write")
    .protected(container.get(DisconnectClusterMcpEndpoint), "clusters:write")
    .protected(container.get(UpdateNodeMcpEndpoint), "clusters:write")
    .protected(container.get(UnregisterNodeMcpEndpoint), "clusters:write")
    .protected(container.get(UnregisterAllNodesMcpEndpoint), "clusters:write")
    .protected(container.get(AssignImageMcpEndpoint), "clusters:write")
    .protected(container.get(UnassignImageMcpEndpoint), "clusters:write")
    .protected(container.get(UpdateAssignedImageMcpEndpoint), "clusters:write")
    .protected(container.get(UpdateVirtualMachineMcpEndpoint), "clusters:write")
    .protected(container.get(UnregisterVirtualMachineMcpEndpoint), "clusters:write")
    .protected(container.get(UnregisterAllVirtualMachinesMcpEndpoint), "clusters:write")
    // Cluster — provisioning sub-scopes
    .protected(container.get(PlanNodesMcpEndpoint), "clusters:provision:plan")
    .protected(container.get(ApplyNodesMcpEndpoint), "clusters:provision:apply")
    .protected(container.get(DestroyNodesMcpEndpoint), "clusters:provision:destroy")
    // Station — reads
    .protected(container.get(ListStationsMcpEndpoint), "stations:read")
    .protected(container.get(StationByIdMcpEndpoint), "stations:read")
    .protected(container.get(ListServicesMcpEndpoint), "stations:read")
    .protected(container.get(ListInstancesMcpEndpoint), "stations:read")
    .protected(container.get(ServicesByBlueprintMcpEndpoint), "stations:read")
    .protected(container.get(ServiceByIdMcpEndpoint), "stations:read")
    .protected(container.get(ServicesByStationMcpEndpoint), "stations:read")
    // Station — writes
    .protected(container.get(InstallStationMcpEndpoint), "stations:write")
    .protected(container.get(UninstallStationMcpEndpoint), "stations:write")
    .protected(container.get(RegisterStationMcpEndpoint), "stations:write")
    .protected(container.get(UpdateStationMcpEndpoint), "stations:write")
    .protected(container.get(UnregisterStationMcpEndpoint), "stations:write")
    .protected(container.get(RegisterServiceMcpEndpoint), "stations:write")
    .protected(container.get(UnregisterServiceMcpEndpoint), "stations:write")
    // Vault — reads / writes (secret retrieval is intentionally NOT exposed)
    .protected(container.get(ListVaultsMcpEndpoint), "vault:read")
    .protected(container.get(ListSecretsMcpEndpoint), "vault:read")
    .protected(container.get(CreateVaultMcpEndpoint), "vault:write")
    .protected(container.get(DeleteVaultMcpEndpoint), "vault:write")
    .protected(container.get(GenerateSecretMcpEndpoint), "vault:write")
    .protected(container.get(DeleteSecretMcpEndpoint), "vault:write")
    .protected(container.get(RenameVaultMcpEndpoint), "vault:write")
    .protected(container.get(RenameSecretMcpEndpoint), "vault:write")
    // Size — reads / writes
    .protected(container.get(ListSizesMcpEndpoint), "sizes:read")
    .protected(container.get(RegisterSizeMcpEndpoint), "sizes:write")
    .protected(container.get(UnregisterSizeMcpEndpoint), "sizes:write")
    // Image catalog — reads / writes
    .protected(container.get(CatalogListImagesMcpEndpoint), "images:read")
    .protected(container.get(CatalogRegisterImageMcpEndpoint), "images:write")
    .protected(container.get(CatalogUpdateImageMcpEndpoint), "images:write")
    .protected(container.get(CatalogUnregisterImageMcpEndpoint), "images:write")
    // Blueprint — reads
    .protected(container.get(ListBlueprintsMcpEndpoint), "blueprints:read")
    .protected(container.get(BlueprintByIdMcpEndpoint), "blueprints:read")
    // Executions cross-cutting
    .protected(container.get(WatchExecutionMcpEndpoint), "executions:read")
    .protected(container.get(ListExecutionsMcpEndpoint), "executions:read")
    .protected(container.get(CancelExecutionMcpEndpoint), "executions:write");
}

function banner(auth: McpAuth): string {
  const policyLine = `devstation-mcp: policy=${
    policy.off
      ? "OFF (full feature exposure)"
      : `prefixes=[${policy.prefixes.join(",")}] allow=[${policy.allowClusters.join(",")}]`
  }`;
  const granted = auth.granted;
  const authLine = `devstation-mcp: auth=${
    granted.length === 0
      ? "OFF — read-only (no MCP access token; configure one via devstation → /mcp)"
      : `scopes=[${granted.join(",")}]`
  }`;
  return `${policyLine}\n${authLine}`;
}

/**
 * Composes + boots the MCP server. Both run paths (the `import.meta
 * .main` tail and the `devstation mcp serve` subcommand) call this.
 */
export async function bootMcpServer(): Promise<{ server: McpSdkServer; banner: string }> {
  const auth = await authorize();
  const server = buildMcpServer(buildEndpoints(auth), buildResources(), policy);
  return { server, banner: banner(auth) };
}

// Entry point: serve over stdio when run directly. A bare import (the
// TUI pulling in this module for the subcommand) leaves `import.meta
// .main` false and never boots/serves.
if (import.meta.main) {
  const { server, banner } = await bootMcpServer();
  await serveStdio(server, banner);
}
