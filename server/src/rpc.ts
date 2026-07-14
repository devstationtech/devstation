/**
 * RPC composition root + entry point — strict mirror of `src/mcp.ts`.
 *
 * Collects each BC's endpoints, builds the `Server`, and (when run
 * directly — `import.meta.main`) serves it over stdio. Imported as a
 * module it just exposes `rpc` / `bootBanner` and does NOT serve.
 *
 * `.public(endpoint)` registers a method that needs no session.
 * `.protected(endpoint)` registers a method that requires a valid
 *   sessionId; the registry wraps it with the Authenticated decorator.
 *
 * Visually scanning this file = scanning the project's RPC surface.
 */
import { container } from "@server/dependencies.ts";
import { VERSION } from "@server/build-info.ts";
import { FileLogger } from "@server/shared/observability/outbound/file-logger.ts";
import { AuthenticationAdapter } from "@server/shared/authentication/outbound/authentication-adapter.ts";

import { Server, serveStdio } from "@server/shared/inbound/rpc/server.ts";
import { EndpointRegistry } from "@server/shared/inbound/rpc/endpoint/endpoint-registry.ts";

import {
  AuthenticateEndpoint,
  ConfiguredEndpoint,
  ConfigureEndpoint,
  CurrentTokenEndpoint,
  GenerateTokenEndpoint,
  RenewEndpoint,
  ResourcesEndpoint,
  RevokeTokenEndpoint,
} from "@server/auth/inbound/rpc/endpoints.ts";

import {
  CreateVaultEndpoint,
  DeleteSecretEndpoint,
  DeleteVaultEndpoint,
  GenerateSecretEndpoint,
  ListSecretsEndpoint,
  ListVaultsEndpoint,
  RenameSecretEndpoint,
  RenameVaultEndpoint,
  RetrieveSecretEndpoint,
} from "@server/vault/inbound/rpc/endpoints.ts";

import {
  ListSizesEndpoint,
  RegisterSizeEndpoint,
  UnregisterSizeEndpoint,
} from "@server/size/inbound/rpc/endpoints.ts";
import {
  ListImagesEndpoint as CatalogListImagesEndpoint,
  RegisterImageEndpoint as CatalogRegisterImageEndpoint,
  UnregisterImageEndpoint as CatalogUnregisterImageEndpoint,
  UpdateImageEndpoint as CatalogUpdateImageEndpoint,
} from "@server/images/inbound/rpc/endpoints.ts";

import {
  BlueprintByIdEndpoint,
  ListBlueprintsEndpoint,
  ValidateBlueprintEndpoint,
} from "@server/blueprint/inbound/rpc/endpoints.ts";

import {
  CancelEndpoint as ExecutionCancelEndpoint,
  ListEndpoint as ExecutionListEndpoint,
  WatchEndpoint as ExecutionWatchEndpoint,
} from "@server/shared/executions/inbound/rpc/endpoints.ts";

import {
  InstallStationEndpoint,
  ListInstancesEndpoint,
  ListServicesEndpoint,
  ListStationsEndpoint,
  RegisterServiceEndpoint,
  RegisterStationEndpoint,
  ServiceByIdEndpoint,
  ServicesByBlueprintEndpoint,
  ServicesByStationEndpoint,
  StationByIdEndpoint,
  UninstallStationEndpoint,
  UnregisterServiceEndpoint,
  UnregisterStationEndpoint,
  UpdateStationEndpoint,
} from "@server/station/inbound/rpc/endpoints.ts";

import {
  AcknowledgeInterruptionEndpoint,
  AssignImageEndpoint,
  BootstrapKeyEndpoint,
  ClusterByIdEndpoint,
  ConnectClusterEndpoint,
  DisconnectClusterEndpoint,
  ListClustersEndpoint,
  ListImagesEndpoint,
  ListOperatingSystemsEndpoint,
  ListProvidersEndpoint,
  ListProxmoxConnectionsEndpoint,
  ListProxmoxNodesEndpoint,
  ListProxmoxVirtualMachinesEndpoint,
  ListVirtualMachineTagsEndpoint,
  ProxmoxImagesCreateEndpoint,
  ProxmoxProvisionEndpoint,
  ProxmoxProvisioningApplyEndpoint,
  ProxmoxProvisioningDestroyEndpoint,
  ProxmoxProvisioningPlanEndpoint,
  ProxmoxVirtualMachineByImageEndpoint,
  ProxmoxVirtualMachineMetricsEndpoint,
  RegisterClusterEndpoint,
  RegisterNodeEndpoint,
  RegisterVirtualMachineEndpoint,
  StorageByNodeEndpoint,
  SubscribeClusterEndpoint,
  TestProxmoxConnectionEndpoint,
  UnassignImageEndpoint,
  UnregisterAllNodesEndpoint,
  UnregisterAllVirtualMachinesEndpoint,
  UnregisterClusterEndpoint,
  UnregisterNodeEndpoint,
  UnregisterVirtualMachineEndpoint,
  UpdateAssignedImageEndpoint,
  UpdateNodeEndpoint,
  UpdateVirtualMachineEndpoint,
} from "@server/cluster/inbound/rpc/endpoints.ts";

export const rpc: Server = new Server(
  EndpointRegistry.empty(container.get(AuthenticationAdapter))
    // Auth — public methods (no session required)
    .public(container.get(ConfiguredEndpoint))
    .public(container.get(ConfigureEndpoint))
    .public(container.get(AuthenticateEndpoint))
    .public(container.get(RenewEndpoint))
    // Auth — public host resources snapshot (UI header, pre-login)
    .public(container.get(ResourcesEndpoint))
    // Auth — MCP access token (protected)
    .protected(container.get(GenerateTokenEndpoint))
    .protected(container.get(CurrentTokenEndpoint))
    .protected(container.get(RevokeTokenEndpoint))
    // Vault — protected methods (every call validates sessionId)
    .protected(container.get(CreateVaultEndpoint))
    .protected(container.get(DeleteVaultEndpoint))
    .protected(container.get(ListVaultsEndpoint))
    .protected(container.get(GenerateSecretEndpoint))
    .protected(container.get(RetrieveSecretEndpoint))
    .protected(container.get(DeleteSecretEndpoint))
    .protected(container.get(RenameVaultEndpoint))
    .protected(container.get(RenameSecretEndpoint))
    .protected(container.get(ListSecretsEndpoint))
    // Size — protected methods
    .protected(container.get(RegisterSizeEndpoint))
    .protected(container.get(UnregisterSizeEndpoint))
    .protected(container.get(ListSizesEndpoint))
    // Image catalog — protected methods
    .protected(container.get(CatalogRegisterImageEndpoint))
    .protected(container.get(CatalogUpdateImageEndpoint))
    .protected(container.get(CatalogUnregisterImageEndpoint))
    .protected(container.get(CatalogListImagesEndpoint))
    // Blueprint — protected methods (read-only catalog)
    .protected(container.get(ListBlueprintsEndpoint))
    .protected(container.get(BlueprintByIdEndpoint))
    // blueprint.validate is public: read-only candidate check for `blueprint register`
    .public(container.get(ValidateBlueprintEndpoint))
    // Executions — generic streaming infrastructure (watch/cancel/list)
    .protected(container.get(ExecutionWatchEndpoint))
    .protected(container.get(ExecutionCancelEndpoint))
    .protected(container.get(ExecutionListEndpoint))
    // Cluster — protected methods (catalog CRUD)
    .protected(container.get(RegisterClusterEndpoint))
    .protected(container.get(SubscribeClusterEndpoint))
    .protected(container.get(UnregisterClusterEndpoint))
    .protected(container.get(ConnectClusterEndpoint))
    .protected(container.get(DisconnectClusterEndpoint))
    .protected(container.get(RegisterNodeEndpoint))
    .protected(container.get(UpdateNodeEndpoint))
    .protected(container.get(UnregisterNodeEndpoint))
    .protected(container.get(UnregisterAllNodesEndpoint))
    .protected(container.get(AcknowledgeInterruptionEndpoint))
    .protected(container.get(AssignImageEndpoint))
    .protected(container.get(UnassignImageEndpoint))
    .protected(container.get(UpdateAssignedImageEndpoint))
    .protected(container.get(RegisterVirtualMachineEndpoint))
    .protected(container.get(UpdateVirtualMachineEndpoint))
    .protected(container.get(UnregisterVirtualMachineEndpoint))
    .protected(container.get(UnregisterAllVirtualMachinesEndpoint))
    .protected(container.get(ListClustersEndpoint))
    .protected(container.get(ClusterByIdEndpoint))
    .protected(container.get(ListImagesEndpoint))
    .protected(container.get(ListProxmoxConnectionsEndpoint))
    .protected(container.get(ListProxmoxNodesEndpoint))
    .protected(container.get(StorageByNodeEndpoint))
    .protected(container.get(ListProxmoxVirtualMachinesEndpoint))
    .protected(container.get(ListVirtualMachineTagsEndpoint))
    .protected(container.get(ListProvidersEndpoint))
    .protected(container.get(ListOperatingSystemsEndpoint))
    .protected(container.get(TestProxmoxConnectionEndpoint))
    .protected(container.get(BootstrapKeyEndpoint))
    .protected(container.get(ProxmoxProvisionEndpoint))
    .protected(container.get(ProxmoxVirtualMachineMetricsEndpoint))
    .protected(container.get(ProxmoxVirtualMachineByImageEndpoint))
    // Cluster — long-running endpoints (LSP-style streaming via operation.event)
    .protected(container.get(ProxmoxProvisioningPlanEndpoint))
    .protected(container.get(ProxmoxProvisioningApplyEndpoint))
    .protected(container.get(ProxmoxProvisioningDestroyEndpoint))
    .protected(container.get(ProxmoxImagesCreateEndpoint))
    // Station — protected methods (catalog CRUD)
    .protected(container.get(RegisterStationEndpoint))
    .protected(container.get(UpdateStationEndpoint))
    .protected(container.get(UnregisterStationEndpoint))
    .protected(container.get(RegisterServiceEndpoint))
    .protected(container.get(UnregisterServiceEndpoint))
    // Station — long-running endpoints (LSP-style streaming via operation.event)
    .protected(container.get(InstallStationEndpoint))
    .protected(container.get(UninstallStationEndpoint))
    // Station — queries
    .protected(container.get(ListStationsEndpoint))
    .protected(container.get(StationByIdEndpoint))
    .protected(container.get(ListInstancesEndpoint))
    .protected(container.get(ListServicesEndpoint))
    .protected(container.get(ServicesByBlueprintEndpoint))
    .protected(container.get(ServiceByIdEndpoint))
    .protected(container.get(ServicesByStationEndpoint)),
  container.get(FileLogger),
  VERSION,
);

/**
 * Boot diagnostics written to stderr by `serveStdio` before serving.
 * Mirror of `mcp.ts:bootBanner`.
 */
export const bootBanner = `devstation-server ${VERSION} — JSON-RPC 2.0 over stdio`;

// Entry point: serve over stdio when run directly (`deno run src/rpc.ts`
// or the compiled `dist/devstation-server`). A bare import — e.g. a
// test pulling in `rpc` — leaves `import.meta.main` false and never
// serves. Mirror of the tail of `src/mcp.ts`.
if (import.meta.main) await serveStdio(rpc, bootBanner);
