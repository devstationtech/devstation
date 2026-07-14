import { Container } from "@server/container.ts";
import {
  BLUEPRINTS_PATH,
  CONFIG_DIR,
  DEVSTATION_HOME,
  HOME,
  LOGS_DIR,
  PROVISIONING_TEMPLATES_PATH,
  USER_BLUEPRINTS_PATH,
} from "@server/env.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { FileLogger } from "@server/shared/observability/outbound/file-logger.ts";
import { DenoCommandProcess } from "@server/shared/process/outbound/deno-command-adapter.ts";
import { InMemoryExecutions } from "@server/shared/executions/outbound/in-memory-executions.ts";
import {
  CancelEndpoint as ExecutionCancelEndpoint,
  ListEndpoint as ExecutionListEndpoint,
  WatchEndpoint as ExecutionWatchEndpoint,
} from "@server/shared/executions/inbound/rpc/endpoints.ts";
import { Query as WatchExecutionQuery } from "@server/shared/executions/application/queries/watch/query.ts";
import { Query as LocalResourcesQuery } from "@server/auth/application/queries/local-resources/query.ts";
// LocalResourcesAdapter is used only as a DI token (interface symbol) below;
// the runtime imports the three OS-specific impls.
import type { LocalResourcesAdapter as LocalResourcesAdapterToken } from "@server/auth/application/queries/local-resources/adapter.ts";
import { LinuxLocalResourcesAdapter } from "@server/auth/outbound/local-resources/linux.ts";
import { DarwinLocalResourcesAdapter } from "@server/auth/outbound/local-resources/darwin.ts";
import { WindowsLocalResourcesAdapter } from "@server/auth/outbound/local-resources/windows.ts";
// Symbol used as the DI key — interfaces are erased at runtime; this is the
// usual pattern to register/resolve a port by its conceptual name.
const LocalResourcesAdapter = Symbol(
  "LocalResourcesAdapter",
) as unknown as (new (...args: unknown[]) => LocalResourcesAdapterToken);
import { AbortExecutionHandler } from "@server/shared/executions/application/handlers/abort-execution-handler.ts";
import { Adapter as ClustersAdapter } from "@server/cluster/outbound/persistence/file-system/adapter.ts";
import { Query as AllClustersQuery } from "@server/cluster/application/queries/all/query.ts";
import { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { Query as AllConnectionsQuery } from "@server/cluster/application/queries/proxmox/connection/all/query.ts";
import { Query as AllNodesQuery } from "@server/cluster/application/queries/proxmox/node/all/query.ts";
import { Query as AllVirtualMachinesQuery } from "@server/cluster/application/queries/proxmox/virtual-machine/all/query.ts";
import { Query as VirtualMachineMetricsQuery } from "@server/cluster/application/queries/proxmox/virtual-machine/metrics/query.ts";
import { Query as TestProxmoxConnectionQuery } from "@server/cluster/application/queries/proxmox/test-connection/query.ts";
import { Query as StoragesByNodeQuery } from "@server/cluster/application/queries/proxmox/storage/by-node/query.ts";
import { RetrieveSecretHandler } from "@server/vault/application/handlers/retrieve-secret-handler.ts";
import { SecretResolverAdapter } from "@server/shared/secrets/outbound/secret-resolver-adapter.ts";
import { SessionResolverAdapter } from "@server/shared/authentication/outbound/session-resolver-adapter.ts";
import { AuthenticationAdapter } from "@server/shared/authentication/outbound/authentication-adapter.ts";
import { ProxmoxReadApiAdapterFactory } from "@server/cluster/application/queries/proxmox/api/factory-adapter.ts";
import { RegisterClusterHandler } from "@server/cluster/application/handlers/proxmox/register-cluster-handler.ts";
import { RegisterClusterEndpoint } from "@server/cluster/inbound/rpc/register/endpoint.ts";
import { SubscribeClusterEndpoint } from "@server/cluster/inbound/rpc/subscribe/endpoint.ts";
import { InMemoryClusterEventSink } from "@server/cluster/inbound/rpc/in-memory-cluster-event-sink.ts";
import { ClusterEventPublisher } from "@server/cluster/inbound/rpc/event-publisher.ts";
import { NodePlanStarted } from "@server/cluster/domain/events/node-plan-started.ts";
import { NodePlanSucceeded } from "@server/cluster/domain/events/node-plan-succeeded.ts";
import { NodePlanFailed } from "@server/cluster/domain/events/node-plan-failed.ts";
import { NodeApplyStarted } from "@server/cluster/domain/events/node-apply-started.ts";
import { NodeApplySucceeded } from "@server/cluster/domain/events/node-apply-succeeded.ts";
import { NodeApplyFailed } from "@server/cluster/domain/events/node-apply-failed.ts";
import { NodeDestroyStarted } from "@server/cluster/domain/events/node-destroy-started.ts";
import { NodeDestroySucceeded } from "@server/cluster/domain/events/node-destroy-succeeded.ts";
import { NodeDestroyFailed } from "@server/cluster/domain/events/node-destroy-failed.ts";
import { UnregisterClusterEndpoint } from "@server/cluster/inbound/rpc/unregister/endpoint.ts";
import { ConnectClusterEndpoint } from "@server/cluster/inbound/rpc/proxmox/connect/endpoint.ts";
import { DisconnectClusterEndpoint } from "@server/cluster/inbound/rpc/proxmox/disconnect/endpoint.ts";
import { RegisterNodeEndpoint } from "@server/cluster/inbound/rpc/proxmox/nodes/register/endpoint.ts";
import { UpdateNodeEndpoint } from "@server/cluster/inbound/rpc/proxmox/nodes/update/endpoint.ts";
import { UnregisterNodeEndpoint } from "@server/cluster/inbound/rpc/proxmox/nodes/unregister/endpoint.ts";
import { UnregisterAllNodesEndpoint } from "@server/cluster/inbound/rpc/proxmox/nodes/unregister-all/endpoint.ts";
import { AcknowledgeInterruptionEndpoint } from "@server/cluster/inbound/rpc/proxmox/nodes/acknowledge-interruption/endpoint.ts";
import { AssignImageEndpoint } from "@server/cluster/inbound/rpc/proxmox/images/assign/endpoint.ts";
import { UnassignImageEndpoint } from "@server/cluster/inbound/rpc/proxmox/images/unassign/endpoint.ts";
import { UpdateAssignedImageEndpoint } from "@server/cluster/inbound/rpc/proxmox/images/update-assigned/endpoint.ts";
import { RegisterVirtualMachineEndpoint } from "@server/cluster/inbound/rpc/proxmox/virtual-machine/register/endpoint.ts";
import { UpdateVirtualMachineEndpoint } from "@server/cluster/inbound/rpc/proxmox/virtual-machine/update/endpoint.ts";
import { UnregisterVirtualMachineEndpoint } from "@server/cluster/inbound/rpc/proxmox/virtual-machine/unregister/endpoint.ts";
import { UnregisterAllVirtualMachinesEndpoint } from "@server/cluster/inbound/rpc/proxmox/virtual-machine/unregister-all/endpoint.ts";
import { ListImagesEndpoint } from "@server/cluster/inbound/rpc/images/list/endpoint.ts";
import { ListProxmoxConnectionsEndpoint } from "@server/cluster/inbound/rpc/proxmox/connections/list/endpoint.ts";
import { ListProxmoxNodesEndpoint } from "@server/cluster/inbound/rpc/proxmox/nodes/list/endpoint.ts";
import { StorageByNodeEndpoint } from "@server/cluster/inbound/rpc/proxmox/storage/by-node/endpoint.ts";
import { ListProxmoxVirtualMachinesEndpoint } from "@server/cluster/inbound/rpc/proxmox/virtual-machine/list/endpoint.ts";
import { ListVirtualMachineTagsEndpoint } from "@server/cluster/inbound/rpc/proxmox/virtual-machine/tags/endpoint.ts";
import { ListProvidersEndpoint } from "@server/cluster/inbound/rpc/providers/list/endpoint.ts";
import { ListOperatingSystemsEndpoint } from "@server/cluster/inbound/rpc/operating-systems/list/endpoint.ts";
import { ListClustersEndpoint } from "@server/cluster/inbound/rpc/list/endpoint.ts";
import { ClusterByIdEndpoint } from "@server/cluster/inbound/rpc/by-id/endpoint.ts";
import { TestProxmoxConnectionEndpoint } from "@server/cluster/inbound/rpc/proxmox/test-connection/endpoint.ts";
import {
  ProxmoxProvisionEndpoint,
  ProxmoxVirtualMachineByImageEndpoint,
  ProxmoxVirtualMachineMetricsEndpoint,
} from "@server/cluster/inbound/rpc/endpoints.ts";
import { Query as VirtualMachineByImageQuery } from "@server/cluster/application/queries/proxmox/virtual-machine/by-image/query.ts";
import { UnregisterClusterHandler } from "@server/cluster/application/handlers/proxmox/unregister-cluster-handler.ts";
import { RegisterNodeHandler } from "@server/cluster/application/handlers/proxmox/register-node-handler.ts";
import { UpdateNodeHandler } from "@server/cluster/application/handlers/proxmox/update-node-handler.ts";
import { UnregisterNodeHandler } from "@server/cluster/application/handlers/proxmox/unregister-node-handler.ts";
import { AcknowledgeInterruptionHandler } from "@server/cluster/application/handlers/proxmox/acknowledge-interruption-handler.ts";
import { UnregisterAllNodesHandler } from "@server/cluster/application/handlers/proxmox/unregister-all-nodes-handler.ts";
import { RegisterVirtualMachineHandler } from "@server/cluster/application/handlers/proxmox/register-virtual-machine-handler.ts";
import { UpdateVirtualMachineHandler } from "@server/cluster/application/handlers/proxmox/update-virtual-machine-handler.ts";
import { UnregisterVirtualMachineHandler } from "@server/cluster/application/handlers/proxmox/unregister-virtual-machine-handler.ts";
import { UnregisterAllVirtualMachinesHandler } from "@server/cluster/application/handlers/proxmox/unregister-all-virtual-machines-handler.ts";
import { ConnectClusterHandler } from "@server/cluster/application/handlers/proxmox/connect-cluster-handler.ts";
import { DisconnectClusterHandler } from "@server/cluster/application/handlers/proxmox/disconnect-cluster-handler.ts";
import { ProvisioningAdapter } from "@server/cluster/outbound/executions/proxmox/provisioning/provisioning-adapter.ts";
import { ProvisioningCli } from "@server/cluster/outbound/executions/proxmox/provisioning/runner.ts";
import { WorkingDir } from "@server/cluster/outbound/executions/proxmox/provisioning/working-dir.ts";
import { CredentialResolver } from "@server/cluster/outbound/credential-resolver.ts";
import { TfvarsBuilder } from "@server/cluster/outbound/executions/proxmox/provisioning/tfvars-builder.ts";
import { ProvisioningEnv } from "@server/cluster/outbound/executions/proxmox/provisioning/provisioning-env.ts";
import { StorageTypeResolverAdapter } from "@server/cluster/outbound/executions/proxmox/storage-type-resolver-adapter.ts";
import { CapacityPreflight } from "@server/cluster/outbound/executions/proxmox/capacity-preflight.ts";
import { PlanNodesHandler } from "@server/cluster/application/handlers/proxmox/provisioning/plan-nodes-handler.ts";
import {
  ProxmoxImagesCreateEndpoint,
  ProxmoxProvisioningApplyEndpoint,
  ProxmoxProvisioningDestroyEndpoint,
  ProxmoxProvisioningPlanEndpoint,
} from "@server/cluster/inbound/rpc/endpoints.ts";
import { ApplyNodesHandler } from "@server/cluster/application/handlers/proxmox/provisioning/apply-nodes-handler.ts";
import { DestroyNodesHandler } from "@server/cluster/application/handlers/proxmox/provisioning/destroy-nodes-handler.ts";
import { Query as ProvisionQuery } from "@server/cluster/application/queries/proxmox/provision/query.ts";
import { SshCli } from "@server/shared/ssh/outbound/cli.ts";
import { IdentityProvider } from "@server/shared/ssh/outbound/identity.ts";
import { Ssh2BootstrapAdapter } from "@server/shared/ssh/outbound/ssh2-bootstrap-adapter.ts";
import { BootstrapKeyHandler } from "@server/cluster/application/handlers/connection/bootstrap-key-handler.ts";
import { BootstrapKeyEndpoint } from "@server/cluster/inbound/rpc/connection/bootstrap-key/endpoint.ts";
import { BootstrapKeyMcpEndpoint } from "@server/cluster/inbound/mcp/connection/bootstrap-key/endpoint.ts";
import { ImagesAdapter } from "@server/cluster/outbound/executions/proxmox/images/adapter.ts";
import { CreateImageHandler } from "@server/cluster/application/handlers/proxmox/create-image-handler.ts";
import { AssignImageHandler } from "@server/cluster/application/handlers/proxmox/assign-image-handler.ts";
import { UnassignImageHandler } from "@server/cluster/application/handlers/proxmox/unassign-image-handler.ts";
import { UpdateAssignedImageHandler } from "@server/cluster/application/handlers/proxmox/update-assigned-image-handler.ts";
import { InProcessBus } from "@server/shared/building-blocks/outbound/events/in-process-bus.ts";
import { ProxmoxInstaller } from "@server/station/outbound/installer/proxmox/installer.ts";
import { RegisterServiceHandler } from "@server/station/application/handlers/register-service-handler.ts";
import { UnregisterServiceHandler } from "@server/station/application/handlers/unregister-service-handler.ts";
import { Adapter as StationsAdapter } from "@server/station/outbound/persistence/file-system/adapter.ts";
import { RegisterStationHandler } from "@server/station/application/handlers/register-station-handler.ts";
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
import { UpdateStationHandler } from "@server/station/application/handlers/update-station-handler.ts";
import { UnregisterStationHandler } from "@server/station/application/handlers/unregister-station-handler.ts";
import { InstallStationHandler } from "@server/station/application/handlers/install-station-handler.ts";
import { UninstallStationHandler } from "@server/station/application/handlers/uninstall-station-handler.ts";
import { ActiveInstalls } from "@server/station/application/services/active-installs.ts";
import { Adapter as StationDispatcherAdapter } from "@server/station/outbound/dispatcher-adapter.ts";
import { Adapter as ClusterDispatcherAdapter } from "@server/cluster/outbound/dispatcher-adapter.ts";
import { Query as AllStationsQuery } from "@server/station/application/queries/all/query.ts";
import { Query as StationByIdQuery } from "@server/station/application/queries/by-id/query.ts";
import { Query as ServicesByStationQuery } from "@server/station/application/queries/services/by-station/query.ts";
import { ServiceInstallSucceeded } from "@server/station/domain/events/service-install-succeeded.ts";
import { StoreServiceSecretsWhenServiceInstallSucceeded } from "@server/vault/inbound/policies/store-service-secrets-when-service-install-succeeded.ts";
import { RecordVirtualMachineServicesHandler } from "@server/cluster/application/handlers/proxmox/record-virtual-machine-services-handler.ts";
import { RecordVirtualMachineServicesWhenServiceInstallSucceeded } from "@server/cluster/inbound/policies/record-virtual-machine-services-when-service-install-succeeded.ts";
import { ServiceUninstalled } from "@server/station/domain/events/service-uninstalled.ts";
import { ForgetVirtualMachineServicesHandler } from "@server/cluster/application/handlers/proxmox/forget-virtual-machine-services-handler.ts";
import { ForgetVirtualMachineServicesWhenServiceUninstalled } from "@server/cluster/inbound/policies/forget-virtual-machine-services-when-service-uninstalled.ts";
import { DeleteServiceSecretsWhenServiceUninstalled } from "@server/vault/inbound/policies/delete-service-secrets-when-service-uninstalled.ts";
import { Query as AllVirtualMachineTagsQuery } from "@server/cluster/application/queries/proxmox/virtual-machine/tags/all/query.ts";
import { Query as AllProvidersQuery } from "@server/cluster/application/queries/providers/all/query.ts";
import { Query as AllOperatingSystemsQuery } from "@server/cluster/application/queries/operating-systems/all/query.ts";
import { Adapter as SizesAdapter } from "@server/size/outbound/persistence/file-system/adapter.ts";
import { Query as AllSizesQuery } from "@server/size/application/queries/all/query.ts";
import { RegisterSizeHandler } from "@server/size/application/handlers/register-size-handler.ts";
import { UnregisterSizeHandler } from "@server/size/application/handlers/unregister-size-handler.ts";
import { Adapter as ImageCatalogAdapter } from "@server/images/outbound/persistence/file-system/adapter.ts";
import { Query as AllCatalogImagesQuery } from "@server/images/application/queries/all/query.ts";
import { Adapter as ImageUsagesAdapter } from "@server/images/outbound/persistence/file-system/image-usages-adapter.ts";
import { RecordImageUsageHandler } from "@server/images/application/handlers/record-image-usage-handler.ts";
import { ForgetImageUsageHandler } from "@server/images/application/handlers/forget-image-usage-handler.ts";
import { TrackImageUsageWhenAssignedToNode } from "@server/images/inbound/policies/track-image-usage-when-assigned-to-node.ts";
import { ForgetImageUsageWhenUnassignedFromNode } from "@server/images/inbound/policies/forget-image-usage-when-unassigned-from-node.ts";
import { ImageAssignedToNode } from "@server/cluster/domain/events/image-assigned-to-node.ts";
import { ImageUnassignedFromNode } from "@server/cluster/domain/events/image-unassigned-from-node.ts";
import { RegisterImageHandler as CatalogRegisterImageHandler } from "@server/images/application/handlers/register-image-handler.ts";
import { UpdateImageHandler as CatalogUpdateImageHandler } from "@server/images/application/handlers/update-image-handler.ts";
import { UnregisterImageHandler as CatalogUnregisterImageHandler } from "@server/images/application/handlers/unregister-image-handler.ts";
import {
  ListImagesEndpoint as CatalogListImagesEndpoint,
  RegisterImageEndpoint as CatalogRegisterImageEndpoint,
  UnregisterImageEndpoint as CatalogUnregisterImageEndpoint,
  UpdateImageEndpoint as CatalogUpdateImageEndpoint,
} from "@server/images/inbound/rpc/endpoints.ts";
import {
  ListImagesMcpEndpoint as CatalogListImagesMcpEndpoint,
  RegisterImageMcpEndpoint as CatalogRegisterImageMcpEndpoint,
  UnregisterImageMcpEndpoint as CatalogUnregisterImageMcpEndpoint,
  UpdateImageMcpEndpoint as CatalogUpdateImageMcpEndpoint,
} from "@server/images/inbound/mcp/endpoints.ts";
import {
  ListSizesEndpoint,
  RegisterSizeEndpoint,
  UnregisterSizeEndpoint,
} from "@server/size/inbound/rpc/endpoints.ts";
import {
  BlueprintByIdEndpoint,
  ListBlueprintsEndpoint,
  ValidateBlueprintEndpoint,
} from "@server/blueprint/inbound/rpc/endpoints.ts";
import { Query as AllImagesQuery } from "@server/cluster/application/queries/images/all/query.ts";
import { SessionsAdapter } from "@server/auth/outbound/sessions-adapter.ts";
import { Query as IsAuthConfiguredQuery } from "@server/auth/application/queries/configured/query.ts";
import { Argon2Adapter } from "@server/auth/outbound/argon2-adapter.ts";
import { KeyWrapAdapter } from "@server/auth/outbound/key-wrap-adapter.ts";
import { TokenStoreAdapter } from "@server/auth/outbound/token-store-adapter.ts";
import { GenerateAccessTokenHandler } from "@server/auth/application/handlers/generate-access-token-handler.ts";
import { LoadAccessTokenHandler } from "@server/auth/application/handlers/load-access-token-handler.ts";
import { RevokeAccessTokenHandler } from "@server/auth/application/handlers/revoke-access-token-handler.ts";
import { RetrieveSessionHandler } from "@server/auth/application/handlers/retrieve-session-handler.ts";
import { ConfigureHandler } from "@server/auth/application/handlers/configure-handler.ts";
import { AuthenticateHandler } from "@server/auth/application/handlers/authenticate-handler.ts";
import { RenewHandler } from "@server/auth/application/handlers/renew-handler.ts";
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
import { Adapter as VaultsAdapter } from "@server/vault/outbound/persistence/file-system/adapter.ts";
import { CryptoAdapter } from "@server/vault/outbound/crypto/adapter.ts";
import { CreateVaultHandler } from "@server/vault/application/handlers/create-vault-handler.ts";
import { DeleteVaultHandler } from "@server/vault/application/handlers/delete-vault-handler.ts";
import { GenerateSecretHandler } from "@server/vault/application/handlers/generate-secret-handler.ts";
import { DeleteSecretHandler } from "@server/vault/application/handlers/delete-secret-handler.ts";
import { RenameVaultHandler } from "@server/vault/application/handlers/rename-vault-handler.ts";
import { RenameSecretHandler } from "@server/vault/application/handlers/rename-secret-handler.ts";
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
import { Query as AllVaultsQuery } from "@server/vault/application/queries/all/query.ts";
import { Query as AllSecretsQuery } from "@server/vault/application/queries/secrets/all/query.ts";
import { Blueprints } from "@server/blueprint/blueprints.ts";
import { Adapter as StationBlueprintsAdapter } from "@server/station/outbound/blueprints/adapter.ts";
import { Query as AllBlueprintsQuery } from "@server/blueprint/application/queries/all/query.ts";
import { Query as BlueprintByIdQuery } from "@server/blueprint/application/queries/by-id/query.ts";
import { Query as ValidateBlueprintQuery } from "@server/blueprint/application/queries/validate/query.ts";
import { SchemaValidator } from "@server/blueprint/parser/schema/schema-validator.ts";
import { Query as AllServicesQuery } from "@server/station/application/queries/services/all/query.ts";
import { Query as ServiceByIdQuery } from "@server/station/application/queries/services/by-id/query.ts";
import { Query as ServicesByBlueprintQuery } from "@server/station/application/queries/services/by-blueprint/query.ts";
import { Query as AllInstancesQuery } from "@server/station/application/queries/instances/all/query.ts";
import {
  AcknowledgeInterruptionMcpEndpoint,
  ApplyNodesMcpEndpoint,
  AssignImageMcpEndpoint,
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
  CancelExecutionMcpEndpoint,
  ExecutionsResource,
  ListExecutionsMcpEndpoint,
  WatchExecutionMcpEndpoint,
} from "@server/shared/executions/inbound/mcp/endpoints.ts";
import { RpcVersionMcpEndpoint } from "@server/shared/inbound/mcp/rpc-version/endpoint.ts";
import { VERSION } from "@server/build-info.ts";

const configDir = CONFIG_DIR;
const logsDir = LOGS_DIR;

export const container: Container = new Container()
  .register(FileSystem, () => new FileSystem(configDir))
  .register(FileLogger, () => new FileLogger(new FileSystem(logsDir)))
  /** Cluster */
  .register(ClustersAdapter, (c) => new ClustersAdapter(c.get(FileSystem), c.get(FileLogger)))
  .register(AllClustersQuery, (c) => new AllClustersQuery(c.get(FileSystem)))
  .register(ListClustersEndpoint, (c) => new ListClustersEndpoint(c.get(AllClustersQuery)))
  .register(ClusterByIdEndpoint, (c) => new ClusterByIdEndpoint(c.get(ClusterByIdQuery)))
  .register(ClusterByIdQuery, (c) => new ClusterByIdQuery(c.get(FileSystem)))
  .register(AllConnectionsQuery, (c) => new AllConnectionsQuery(c.get(FileSystem)))
  .register(
    ListProxmoxConnectionsEndpoint,
    (c) => new ListProxmoxConnectionsEndpoint(c.get(AllConnectionsQuery)),
  )
  .register(
    RetrieveSecretHandler,
    (c) => new RetrieveSecretHandler(c.get(VaultsAdapter), c.get(CryptoAdapter)),
  )
  .register(
    SecretResolverAdapter,
    (c) => new SecretResolverAdapter(c.get(RetrieveSecretHandler), c.get(SessionResolverAdapter)),
  )
  .register(
    ProxmoxReadApiAdapterFactory,
    (c) => new ProxmoxReadApiAdapterFactory(c.get(SecretResolverAdapter)),
  )
  .register(
    AllNodesQuery,
    (c) =>
      new AllNodesQuery(
        c.get(FileSystem),
        c.get(ProxmoxReadApiAdapterFactory),
        c.get(FileLogger),
      ),
  )
  .register(
    ListProxmoxNodesEndpoint,
    (c) => new ListProxmoxNodesEndpoint(c.get(AllNodesQuery)),
  )
  .register(
    StoragesByNodeQuery,
    (c) => new StoragesByNodeQuery(c.get(FileSystem), c.get(ProxmoxReadApiAdapterFactory)),
  )
  .register(
    StorageByNodeEndpoint,
    (c) => new StorageByNodeEndpoint(c.get(StoragesByNodeQuery)),
  )
  .register(
    AllVirtualMachinesQuery,
    (c) => new AllVirtualMachinesQuery(c.get(FileSystem), c.get(ProxmoxReadApiAdapterFactory)),
  )
  .register(
    ListProxmoxVirtualMachinesEndpoint,
    (c) => new ListProxmoxVirtualMachinesEndpoint(c.get(AllVirtualMachinesQuery)),
  )
  .register(AllVirtualMachineTagsQuery, (c) => new AllVirtualMachineTagsQuery(c.get(FileSystem)))
  .register(
    ListVirtualMachineTagsEndpoint,
    (c) => new ListVirtualMachineTagsEndpoint(c.get(AllVirtualMachineTagsQuery)),
  )
  .register(AllProvidersQuery, () => new AllProvidersQuery())
  .register(ListProvidersEndpoint, (c) => new ListProvidersEndpoint(c.get(AllProvidersQuery)))
  .register(AllOperatingSystemsQuery, () => new AllOperatingSystemsQuery())
  .register(
    ListOperatingSystemsEndpoint,
    (c) => new ListOperatingSystemsEndpoint(c.get(AllOperatingSystemsQuery)),
  )
  .register(
    VirtualMachineMetricsQuery,
    (c) => new VirtualMachineMetricsQuery(c.get(FileSystem), c.get(ProxmoxReadApiAdapterFactory)),
  )
  .register(
    ProxmoxVirtualMachineMetricsEndpoint,
    (c) => new ProxmoxVirtualMachineMetricsEndpoint(c.get(VirtualMachineMetricsQuery)),
  )
  .register(VirtualMachineByImageQuery, (c) => new VirtualMachineByImageQuery(c.get(FileSystem)))
  .register(
    ProxmoxVirtualMachineByImageEndpoint,
    (c) => new ProxmoxVirtualMachineByImageEndpoint(c.get(VirtualMachineByImageQuery)),
  )
  .register(TestProxmoxConnectionQuery, () => new TestProxmoxConnectionQuery())
  .register(
    TestProxmoxConnectionEndpoint,
    (c) => new TestProxmoxConnectionEndpoint(c.get(TestProxmoxConnectionQuery)),
  )
  .register(RegisterClusterHandler, (c) => new RegisterClusterHandler(c.get(ClustersAdapter)))
  .register(
    RegisterClusterEndpoint,
    (c) => new RegisterClusterEndpoint(c.get(RegisterClusterHandler)),
  )
  .register(UnregisterClusterHandler, (c) => new UnregisterClusterHandler(c.get(ClustersAdapter)))
  .register(
    UnregisterClusterEndpoint,
    (c) => new UnregisterClusterEndpoint(c.get(UnregisterClusterHandler)),
  )
  /** Cluster Nodes */
  .register(RegisterNodeHandler, (c) => new RegisterNodeHandler(c.get(ClustersAdapter)))
  .register(RegisterNodeEndpoint, (c) => new RegisterNodeEndpoint(c.get(RegisterNodeHandler)))
  .register(UpdateNodeHandler, (c) => new UpdateNodeHandler(c.get(ClustersAdapter)))
  .register(UpdateNodeEndpoint, (c) => new UpdateNodeEndpoint(c.get(UpdateNodeHandler)))
  .register(UnregisterNodeHandler, (c) => new UnregisterNodeHandler(c.get(ClustersAdapter)))
  .register(
    UnregisterNodeEndpoint,
    (c) => new UnregisterNodeEndpoint(c.get(UnregisterNodeHandler)),
  )
  .register(UnregisterAllNodesHandler, (c) => new UnregisterAllNodesHandler(c.get(ClustersAdapter)))
  .register(
    UnregisterAllNodesEndpoint,
    (c) => new UnregisterAllNodesEndpoint(c.get(UnregisterAllNodesHandler)),
  )
  .register(
    AcknowledgeInterruptionHandler,
    (c) =>
      new AcknowledgeInterruptionHandler(
        c.get(ClustersAdapter),
        c.get(ClusterDispatcherAdapter),
      ),
  )
  .register(
    AcknowledgeInterruptionEndpoint,
    (c) => new AcknowledgeInterruptionEndpoint(c.get(AcknowledgeInterruptionHandler)),
  )
  /** Cluster Virtual Machines */
  .register(
    RegisterVirtualMachineHandler,
    (c) => new RegisterVirtualMachineHandler(c.get(ClustersAdapter)),
  )
  .register(
    RegisterVirtualMachineEndpoint,
    (c) => new RegisterVirtualMachineEndpoint(c.get(RegisterVirtualMachineHandler)),
  )
  .register(
    UpdateVirtualMachineHandler,
    (c) => new UpdateVirtualMachineHandler(c.get(ClustersAdapter)),
  )
  .register(
    UpdateVirtualMachineEndpoint,
    (c) => new UpdateVirtualMachineEndpoint(c.get(UpdateVirtualMachineHandler)),
  )
  .register(
    UnregisterVirtualMachineHandler,
    (c) => new UnregisterVirtualMachineHandler(c.get(ClustersAdapter)),
  )
  .register(
    UnregisterVirtualMachineEndpoint,
    (c) => new UnregisterVirtualMachineEndpoint(c.get(UnregisterVirtualMachineHandler)),
  )
  .register(
    UnregisterAllVirtualMachinesHandler,
    (c) => new UnregisterAllVirtualMachinesHandler(c.get(ClustersAdapter)),
  )
  .register(
    UnregisterAllVirtualMachinesEndpoint,
    (c) => new UnregisterAllVirtualMachinesEndpoint(c.get(UnregisterAllVirtualMachinesHandler)),
  )
  /** Cluster Provider Connection */
  .register(
    ConnectClusterHandler,
    (c) =>
      new ConnectClusterHandler(
        c.get(ClustersAdapter),
        c.get(SecretResolverAdapter),
      ),
  )
  .register(
    ConnectClusterEndpoint,
    (c) => new ConnectClusterEndpoint(c.get(ConnectClusterHandler)),
  )
  .register(DisconnectClusterHandler, (c) => new DisconnectClusterHandler(c.get(ClustersAdapter)))
  .register(
    DisconnectClusterEndpoint,
    (c) => new DisconnectClusterEndpoint(c.get(DisconnectClusterHandler)),
  )
  /** Shared Process + Execution Store */
  .register(DenoCommandProcess, () => new DenoCommandProcess())
  .register(InMemoryExecutions, () => new InMemoryExecutions())
  .register(WatchExecutionQuery, (c) => new WatchExecutionQuery(c.get(InMemoryExecutions)))
  // Per-OS LocalResources adapter. Singleton because the Linux impl
  // keeps a /proc/stat snapshot for delta-based CPU%; mac + windows are
  // stateless but registered the same way.
  .register(LocalResourcesAdapter, (c) => {
    if (Deno.build.os === "darwin") {
      return new DarwinLocalResourcesAdapter(c.get(DenoCommandProcess));
    }
    if (Deno.build.os === "windows") {
      return new WindowsLocalResourcesAdapter(c.get(DenoCommandProcess));
    }
    return new LinuxLocalResourcesAdapter(new FileSystem(""));
  })
  .register(LocalResourcesQuery, (c) => new LocalResourcesQuery(c.get(LocalResourcesAdapter)))
  .register(AbortExecutionHandler, (c) => new AbortExecutionHandler(c.get(InMemoryExecutions)))
  /** Executions RPC endpoints — generic watch/cancel/list */
  .register(ExecutionWatchEndpoint, (c) => new ExecutionWatchEndpoint(c.get(InMemoryExecutions)))
  .register(ExecutionCancelEndpoint, (c) => new ExecutionCancelEndpoint(c.get(InMemoryExecutions)))
  .register(ExecutionListEndpoint, (c) => new ExecutionListEndpoint(c.get(InMemoryExecutions)))
  /** Cluster Provisioning Provisioning */
  .register(CredentialResolver, (c) => new CredentialResolver(c.get(SecretResolverAdapter)))
  .register(ProvisioningCli, (c) => new ProvisioningCli(c.get(DenoCommandProcess)))
  .register(SshCli, (c) => new SshCli(c.get(DenoCommandProcess)))
  // Single shared identity for all automated SSH ops.
  // Lives at ~/.ssh/devstation_ed25519 (POSIX standard, recognized by
  // ssh/ssh-add/ssh-copy-id without -i flags).
  .register(IdentityProvider, (c) => new IdentityProvider(HOME, c.get(DenoCommandProcess)))
  // One-shot password SSH to install the automation key on a remote
  // (Proxmox node or VM). After this, automation runs key-only through
  // SshCli. Cross-OS via ssh2 lib (npm: compat).
  .register(Ssh2BootstrapAdapter, () => new Ssh2BootstrapAdapter())
  .register(
    BootstrapKeyHandler,
    (c) =>
      new BootstrapKeyHandler(
        c.get(ClustersAdapter),
        c.get(CredentialResolver),
        c.get(IdentityProvider),
        c.get(Ssh2BootstrapAdapter),
      ),
  )
  .register(BootstrapKeyEndpoint, (c) => new BootstrapKeyEndpoint(c.get(BootstrapKeyHandler)))
  .register(BootstrapKeyMcpEndpoint, (c) => new BootstrapKeyMcpEndpoint(c.get(BootstrapKeyHandler)))
  .register(WorkingDir, () => new WorkingDir(PROVISIONING_TEMPLATES_PATH, configDir))
  .register(
    StorageTypeResolverAdapter,
    (c) => new StorageTypeResolverAdapter(c.get(ProxmoxReadApiAdapterFactory)),
  )
  .register(
    CapacityPreflight,
    (c) => new CapacityPreflight(c.get(ProxmoxReadApiAdapterFactory)),
  )
  .register(
    TfvarsBuilder,
    (c) =>
      new TfvarsBuilder(
        c.get(SecretResolverAdapter),
        c.get(StorageTypeResolverAdapter),
        c.get(IdentityProvider),
      ),
  )
  .register(ProvisioningEnv, (c) => new ProvisioningEnv(c.get(SessionResolverAdapter)))
  .register(
    ProvisioningAdapter,
    (c) =>
      new ProvisioningAdapter(
        c.get(ProvisioningCli),
        c.get(WorkingDir),
        c.get(CredentialResolver),
        c.get(TfvarsBuilder),
        c.get(ProvisioningEnv),
        c.get(SshCli),
        c.get(IdentityProvider),
        c.get(CapacityPreflight),
      ),
  )
  .register(ProvisionQuery, (c) => new ProvisionQuery(c.get(FileSystem)))
  .register(ProxmoxProvisionEndpoint, (c) => new ProxmoxProvisionEndpoint(c.get(ProvisionQuery)))
  .register(
    PlanNodesHandler,
    (c) =>
      new PlanNodesHandler(
        c.get(ClustersAdapter),
        c.get(InMemoryExecutions),
        c.get(ProvisioningAdapter),
        c.get(ClusterDispatcherAdapter),
      ),
  )
  .register(
    ProxmoxProvisioningPlanEndpoint,
    (c) => new ProxmoxProvisioningPlanEndpoint(c.get(PlanNodesHandler)),
  )
  .register(
    ApplyNodesHandler,
    (c) =>
      new ApplyNodesHandler(
        c.get(ClustersAdapter),
        c.get(InMemoryExecutions),
        c.get(ProvisioningAdapter),
        c.get(ClusterDispatcherAdapter),
      ),
  )
  .register(
    ProxmoxProvisioningApplyEndpoint,
    (c) => new ProxmoxProvisioningApplyEndpoint(c.get(ApplyNodesHandler)),
  )
  .register(
    DestroyNodesHandler,
    (c) =>
      new DestroyNodesHandler(
        c.get(ClustersAdapter),
        c.get(InMemoryExecutions),
        c.get(ProvisioningAdapter),
        c.get(ClusterDispatcherAdapter),
      ),
  )
  .register(
    ProxmoxProvisioningDestroyEndpoint,
    (c) => new ProxmoxProvisioningDestroyEndpoint(c.get(DestroyNodesHandler)),
  )
  /** Cluster Proxmox Image (provider-specific) */
  .register(
    ImagesAdapter,
    (c) =>
      new ImagesAdapter(
        c.get(SshCli),
        c.get(IdentityProvider),
        c.get(CredentialResolver),
        new FileSystem(PROVISIONING_TEMPLATES_PATH),
      ),
  )
  .register(
    CreateImageHandler,
    (c) =>
      new CreateImageHandler(
        c.get(ClustersAdapter),
        c.get(InMemoryExecutions),
        c.get(ImagesAdapter),
      ),
  )
  .register(
    ProxmoxImagesCreateEndpoint,
    (c) => new ProxmoxImagesCreateEndpoint(c.get(CreateImageHandler)),
  )
  .register(
    AssignImageHandler,
    (c) => new AssignImageHandler(c.get(ClustersAdapter), c.get(ClusterDispatcherAdapter)),
  )
  .register(AssignImageEndpoint, (c) => new AssignImageEndpoint(c.get(AssignImageHandler)))
  .register(
    UnassignImageHandler,
    (c) => new UnassignImageHandler(c.get(ClustersAdapter), c.get(ClusterDispatcherAdapter)),
  )
  .register(
    UnassignImageEndpoint,
    (c) => new UnassignImageEndpoint(c.get(UnassignImageHandler)),
  )
  .register(
    UpdateAssignedImageHandler,
    (c) => new UpdateAssignedImageHandler(c.get(ClustersAdapter)),
  )
  .register(
    UpdateAssignedImageEndpoint,
    (c) => new UpdateAssignedImageEndpoint(c.get(UpdateAssignedImageHandler)),
  )
  /** Station (aggregate root — owns services as internal entities) */
  .register(StationsAdapter, (c) => new StationsAdapter(c.get(FileSystem)))
  .register(ProxmoxInstaller, (c) => new ProxmoxInstaller(c.get(SshCli), c.get(IdentityProvider)))
  .register(
    RegisterStationHandler,
    (c) => new RegisterStationHandler(c.get(StationsAdapter), c.get(StationDispatcherAdapter)),
  )
  .register(
    RegisterStationEndpoint,
    (c) => new RegisterStationEndpoint(c.get(RegisterStationHandler)),
  )
  .register(
    UpdateStationHandler,
    (c) => new UpdateStationHandler(c.get(StationsAdapter), c.get(StationDispatcherAdapter)),
  )
  .register(
    UpdateStationEndpoint,
    (c) => new UpdateStationEndpoint(c.get(UpdateStationHandler)),
  )
  .register(
    UnregisterStationHandler,
    (c) => new UnregisterStationHandler(c.get(StationsAdapter), c.get(StationDispatcherAdapter)),
  )
  .register(
    UnregisterStationEndpoint,
    (c) => new UnregisterStationEndpoint(c.get(UnregisterStationHandler)),
  )
  .register(
    StationBlueprintsAdapter,
    (c) => new StationBlueprintsAdapter(c.get(Blueprints)),
  )
  .register(
    RegisterServiceHandler,
    (c) =>
      new RegisterServiceHandler(
        c.get(StationsAdapter),
        c.get(StationBlueprintsAdapter),
        c.get(StationDispatcherAdapter),
      ),
  )
  .register(
    RegisterServiceEndpoint,
    (c) => new RegisterServiceEndpoint(c.get(RegisterServiceHandler)),
  )
  .register(
    UnregisterServiceHandler,
    (c) => new UnregisterServiceHandler(c.get(StationsAdapter), c.get(StationDispatcherAdapter)),
  )
  .register(
    UnregisterServiceEndpoint,
    (c) => new UnregisterServiceEndpoint(c.get(UnregisterServiceHandler)),
  )
  .register(ActiveInstalls, () => new ActiveInstalls())
  .register(
    InstallStationHandler,
    (c) =>
      new InstallStationHandler(
        c.get(StationsAdapter),
        c.get(StationBlueprintsAdapter),
        c.get(SecretResolverAdapter),
        c.get(ProxmoxInstaller),
        c.get(InMemoryExecutions),
        c.get(StationDispatcherAdapter),
        c.get(ActiveInstalls),
      ),
  )
  .register(
    InstallStationEndpoint,
    (c) => new InstallStationEndpoint(c.get(InstallStationHandler)),
  )
  .register(
    UninstallStationHandler,
    (c) =>
      new UninstallStationHandler(
        c.get(StationsAdapter),
        c.get(StationBlueprintsAdapter),
        c.get(SecretResolverAdapter),
        c.get(ProxmoxInstaller),
        c.get(InMemoryExecutions),
        c.get(StationDispatcherAdapter),
        c.get(ActiveInstalls),
      ),
  )
  .register(
    UninstallStationEndpoint,
    (c) => new UninstallStationEndpoint(c.get(UninstallStationHandler)),
  )
  .register(AllStationsQuery, (c) => new AllStationsQuery(c.get(FileSystem)))
  .register(
    ListStationsEndpoint,
    (c) => new ListStationsEndpoint(c.get(AllStationsQuery)),
  )
  .register(StationByIdQuery, (c) => new StationByIdQuery(c.get(FileSystem)))
  .register(
    StationByIdEndpoint,
    (c) => new StationByIdEndpoint(c.get(StationByIdQuery)),
  )
  .register(ServicesByStationQuery, (c) => new ServicesByStationQuery(c.get(FileSystem)))
  .register(
    ServicesByStationEndpoint,
    (c) => new ServicesByStationEndpoint(c.get(ServicesByStationQuery)),
  )
  /** Vault — service-install listener (persists each installation's secrets) */
  .register(
    StoreServiceSecretsWhenServiceInstallSucceeded,
    (c) =>
      new StoreServiceSecretsWhenServiceInstallSucceeded(
        c.get(GenerateSecretHandler),
        c.get(SessionResolverAdapter),
      ),
  )
  /** Cluster — service-install listener (projects vm.services on each VM) */
  .register(
    RecordVirtualMachineServicesHandler,
    (c) => new RecordVirtualMachineServicesHandler(c.get(ClustersAdapter)),
  )
  .register(
    RecordVirtualMachineServicesWhenServiceInstallSucceeded,
    (c) =>
      new RecordVirtualMachineServicesWhenServiceInstallSucceeded(
        c.get(RecordVirtualMachineServicesHandler),
      ),
  )
  /** Vault — service-uninstall listener (removes the service's secrets) */
  .register(
    DeleteServiceSecretsWhenServiceUninstalled,
    (c) =>
      new DeleteServiceSecretsWhenServiceUninstalled(
        c.get(VaultsAdapter),
        c.get(DeleteSecretHandler),
      ),
  )
  /** Cluster — service-uninstall listener (drops vm.services projection) */
  .register(
    ForgetVirtualMachineServicesHandler,
    (c) => new ForgetVirtualMachineServicesHandler(c.get(ClustersAdapter)),
  )
  .register(
    ForgetVirtualMachineServicesWhenServiceUninstalled,
    (c) =>
      new ForgetVirtualMachineServicesWhenServiceUninstalled(
        c.get(ForgetVirtualMachineServicesHandler),
      ),
  )
  /** Cluster event seam: one sink shared by the publisher (emit) and the
   * cluster.subscribe endpoint (register). */
  .register(InMemoryClusterEventSink, () => new InMemoryClusterEventSink())
  .register(
    ClusterEventPublisher,
    (c) => new ClusterEventPublisher(c.get(InMemoryClusterEventSink)),
  )
  .register(
    SubscribeClusterEndpoint,
    (c) => new SubscribeClusterEndpoint(c.get(InMemoryClusterEventSink)),
  )
  /** Wire bus + subscribe service-install listeners under stations.v1 topic,
   * and the cluster event publisher under clusters.v1. */
  .register(InProcessBus, (c) => {
    const bus = new InProcessBus(c.get(FileLogger));
    bus.subscribe(
      StationDispatcherAdapter.TOPIC,
      ServiceInstallSucceeded,
      c.get(StoreServiceSecretsWhenServiceInstallSucceeded),
    );
    bus.subscribe(
      StationDispatcherAdapter.TOPIC,
      ServiceInstallSucceeded,
      c.get(RecordVirtualMachineServicesWhenServiceInstallSucceeded),
    );
    bus.subscribe(
      StationDispatcherAdapter.TOPIC,
      ServiceUninstalled,
      c.get(DeleteServiceSecretsWhenServiceUninstalled),
    );
    bus.subscribe(
      StationDispatcherAdapter.TOPIC,
      ServiceUninstalled,
      c.get(ForgetVirtualMachineServicesWhenServiceUninstalled),
    );
    const pub = c.get(ClusterEventPublisher);
    bus.subscribe(ClusterDispatcherAdapter.TOPIC, NodePlanStarted, {
      on: (e) => pub.publish(e),
    });
    bus.subscribe(ClusterDispatcherAdapter.TOPIC, NodePlanSucceeded, {
      on: (e) => pub.publish(e),
    });
    bus.subscribe(ClusterDispatcherAdapter.TOPIC, NodePlanFailed, {
      on: (e) => pub.publish(e),
    });
    bus.subscribe(ClusterDispatcherAdapter.TOPIC, NodeApplyStarted, {
      on: (e) => pub.publish(e),
    });
    bus.subscribe(ClusterDispatcherAdapter.TOPIC, NodeApplySucceeded, {
      on: (e) => pub.publish(e),
    });
    bus.subscribe(ClusterDispatcherAdapter.TOPIC, NodeApplyFailed, {
      on: (e) => pub.publish(e),
    });
    bus.subscribe(ClusterDispatcherAdapter.TOPIC, NodeDestroyStarted, {
      on: (e) => pub.publish(e),
    });
    bus.subscribe(ClusterDispatcherAdapter.TOPIC, NodeDestroySucceeded, {
      on: (e) => pub.publish(e),
    });
    bus.subscribe(ClusterDispatcherAdapter.TOPIC, NodeDestroyFailed, {
      on: (e) => pub.publish(e),
    });
    bus.subscribe(
      ClusterDispatcherAdapter.TOPIC,
      ImageAssignedToNode,
      c.get(TrackImageUsageWhenAssignedToNode),
    );
    bus.subscribe(
      ClusterDispatcherAdapter.TOPIC,
      ImageUnassignedFromNode,
      c.get(ForgetImageUsageWhenUnassignedFromNode),
    );
    return bus;
  })
  /** Station dispatcher — owns the "stations.v1" topic */
  .register(StationDispatcherAdapter, (c) => new StationDispatcherAdapter(c.get(InProcessBus)))
  /** Cluster dispatcher — owns the "clusters.v1" topic */
  .register(ClusterDispatcherAdapter, (c) => new ClusterDispatcherAdapter(c.get(InProcessBus)))
  /** Size */
  .register(SizesAdapter, (c) => new SizesAdapter(c.get(FileSystem), c.get(FileLogger)))
  .register(AllSizesQuery, (c) => new AllSizesQuery(c.get(FileSystem)))
  .register(
    RegisterSizeHandler,
    (c) => new RegisterSizeHandler(c.get(SizesAdapter)),
  )
  .register(
    UnregisterSizeHandler,
    (c) => new UnregisterSizeHandler(c.get(SizesAdapter)),
  )
  .register(
    RegisterSizeEndpoint,
    (c) => new RegisterSizeEndpoint(c.get(RegisterSizeHandler)),
  )
  .register(
    UnregisterSizeEndpoint,
    (c) => new UnregisterSizeEndpoint(c.get(UnregisterSizeHandler)),
  )
  .register(
    ListSizesEndpoint,
    (c) => new ListSizesEndpoint(c.get(AllSizesQuery)),
  )
  /** Image catalog */
  .register(
    ImageCatalogAdapter,
    (c) => new ImageCatalogAdapter(c.get(FileSystem), c.get(FileLogger)),
  )
  .register(ImageUsagesAdapter, (c) => new ImageUsagesAdapter(c.get(FileSystem)))
  .register(
    AllCatalogImagesQuery,
    (c) => new AllCatalogImagesQuery(c.get(FileSystem), c.get(ImageUsagesAdapter)),
  )
  .register(RecordImageUsageHandler, (c) => new RecordImageUsageHandler(c.get(ImageUsagesAdapter)))
  .register(ForgetImageUsageHandler, (c) => new ForgetImageUsageHandler(c.get(ImageUsagesAdapter)))
  .register(
    TrackImageUsageWhenAssignedToNode,
    (c) => new TrackImageUsageWhenAssignedToNode(c.get(RecordImageUsageHandler)),
  )
  .register(
    ForgetImageUsageWhenUnassignedFromNode,
    (c) => new ForgetImageUsageWhenUnassignedFromNode(c.get(ForgetImageUsageHandler)),
  )
  .register(
    CatalogRegisterImageHandler,
    (c) => new CatalogRegisterImageHandler(c.get(ImageCatalogAdapter)),
  )
  .register(
    CatalogUpdateImageHandler,
    (c) => new CatalogUpdateImageHandler(c.get(ImageCatalogAdapter)),
  )
  .register(
    CatalogUnregisterImageHandler,
    (c) => new CatalogUnregisterImageHandler(c.get(ImageCatalogAdapter)),
  )
  .register(
    CatalogRegisterImageEndpoint,
    (c) => new CatalogRegisterImageEndpoint(c.get(CatalogRegisterImageHandler)),
  )
  .register(
    CatalogUpdateImageEndpoint,
    (c) => new CatalogUpdateImageEndpoint(c.get(CatalogUpdateImageHandler)),
  )
  .register(
    CatalogUnregisterImageEndpoint,
    (c) => new CatalogUnregisterImageEndpoint(c.get(CatalogUnregisterImageHandler)),
  )
  .register(
    CatalogListImagesEndpoint,
    (c) => new CatalogListImagesEndpoint(c.get(AllCatalogImagesQuery)),
  )
  /** Image (read-side queries, images are nested inside clusters.json) */
  .register(AllImagesQuery, (c) => new AllImagesQuery(c.get(FileSystem)))
  .register(ListImagesEndpoint, (c) => new ListImagesEndpoint(c.get(AllImagesQuery)))
  /** Auth */
  .register(SessionsAdapter, () => new SessionsAdapter())
  .register(RetrieveSessionHandler, (c) => new RetrieveSessionHandler(c.get(SessionsAdapter)))
  .register(
    SessionResolverAdapter,
    (c) => new SessionResolverAdapter(c.get(RetrieveSessionHandler)),
  )
  .register(Argon2Adapter, (c) => new Argon2Adapter(c.get(FileSystem)))
  .register(IsAuthConfiguredQuery, (c) => new IsAuthConfiguredQuery(c.get(FileSystem)))
  .register(
    ConfigureHandler,
    (c) => new ConfigureHandler(c.get(Argon2Adapter), c.get(SessionsAdapter)),
  )
  .register(
    AuthenticateHandler,
    (c) => new AuthenticateHandler(c.get(Argon2Adapter), c.get(SessionsAdapter)),
  )
  .register(RenewHandler, (c) => new RenewHandler(c.get(SessionsAdapter)))
  /** Auth — MCP access token */
  .register(KeyWrapAdapter, () => new KeyWrapAdapter())
  .register(
    TokenStoreAdapter,
    () => new TokenStoreAdapter(new FileSystem(DEVSTATION_HOME)),
  )
  .register(
    GenerateAccessTokenHandler,
    (c) =>
      new GenerateAccessTokenHandler(
        c.get(SessionsAdapter),
        c.get(KeyWrapAdapter),
        c.get(TokenStoreAdapter),
      ),
  )
  .register(
    LoadAccessTokenHandler,
    (c) => new LoadAccessTokenHandler(c.get(TokenStoreAdapter)),
  )
  .register(
    RevokeAccessTokenHandler,
    (c) => new RevokeAccessTokenHandler(c.get(TokenStoreAdapter)),
  )
  /** Auth — RPC endpoints */
  .register(ConfiguredEndpoint, (c) => new ConfiguredEndpoint(c.get(IsAuthConfiguredQuery)))
  .register(ResourcesEndpoint, (c) => new ResourcesEndpoint(c.get(LocalResourcesQuery)))
  .register(ConfigureEndpoint, (c) => new ConfigureEndpoint(c.get(ConfigureHandler)))
  .register(AuthenticateEndpoint, (c) => new AuthenticateEndpoint(c.get(AuthenticateHandler)))
  .register(RenewEndpoint, (c) => new RenewEndpoint(c.get(RenewHandler)))
  .register(
    GenerateTokenEndpoint,
    (c) => new GenerateTokenEndpoint(c.get(GenerateAccessTokenHandler)),
  )
  .register(
    CurrentTokenEndpoint,
    (c) => new CurrentTokenEndpoint(c.get(LoadAccessTokenHandler)),
  )
  .register(
    RevokeTokenEndpoint,
    (c) => new RevokeTokenEndpoint(c.get(RevokeAccessTokenHandler)),
  )
  /** Shared — Authentication bridge consumed by every protected RPC endpoint */
  .register(AuthenticationAdapter, (c) => new AuthenticationAdapter(c.get(SessionsAdapter)))
  /** Vault */
  .register(VaultsAdapter, (c) => new VaultsAdapter(c.get(FileSystem)))
  .register(CryptoAdapter, () => new CryptoAdapter())
  .register(CreateVaultHandler, (c) => new CreateVaultHandler(c.get(VaultsAdapter)))
  .register(DeleteVaultHandler, (c) => new DeleteVaultHandler(c.get(VaultsAdapter)))
  .register(
    GenerateSecretHandler,
    (c) => new GenerateSecretHandler(c.get(VaultsAdapter), c.get(CryptoAdapter)),
  )
  .register(DeleteSecretHandler, (c) => new DeleteSecretHandler(c.get(VaultsAdapter)))
  .register(RenameVaultHandler, (c) => new RenameVaultHandler(c.get(VaultsAdapter)))
  .register(RenameSecretHandler, (c) => new RenameSecretHandler(c.get(VaultsAdapter)))
  .register(AllVaultsQuery, (c) => new AllVaultsQuery(c.get(FileSystem)))
  .register(AllSecretsQuery, (c) => new AllSecretsQuery(c.get(FileSystem)))
  /** Vault — RPC endpoints */
  .register(CreateVaultEndpoint, (c) => new CreateVaultEndpoint(c.get(CreateVaultHandler)))
  .register(DeleteVaultEndpoint, (c) => new DeleteVaultEndpoint(c.get(DeleteVaultHandler)))
  .register(ListVaultsEndpoint, (c) => new ListVaultsEndpoint(c.get(AllVaultsQuery)))
  .register(GenerateSecretEndpoint, (c) => new GenerateSecretEndpoint(c.get(GenerateSecretHandler)))
  .register(RetrieveSecretEndpoint, (c) => new RetrieveSecretEndpoint(c.get(RetrieveSecretHandler)))
  .register(DeleteSecretEndpoint, (c) => new DeleteSecretEndpoint(c.get(DeleteSecretHandler)))
  .register(RenameVaultEndpoint, (c) => new RenameVaultEndpoint(c.get(RenameVaultHandler)))
  .register(RenameSecretEndpoint, (c) => new RenameSecretEndpoint(c.get(RenameSecretHandler)))
  .register(ListSecretsEndpoint, (c) => new ListSecretsEndpoint(c.get(AllSecretsQuery)))
  /** Blueprint (stacks read-only — TS in stacks/<name>/stack.ts) */
  .register(
    Blueprints,
    () =>
      new Blueprints([
        { fs: new FileSystem(BLUEPRINTS_PATH), origin: "official" },
        { fs: new FileSystem(USER_BLUEPRINTS_PATH), origin: "local" },
      ]),
  )
  .register(AllBlueprintsQuery, (c) => new AllBlueprintsQuery(c.get(Blueprints)))
  .register(BlueprintByIdQuery, (c) => new BlueprintByIdQuery(c.get(Blueprints)))
  .register(SchemaValidator, () => new SchemaValidator(new FileSystem(BLUEPRINTS_PATH)))
  .register(
    ValidateBlueprintQuery,
    (c) =>
      new ValidateBlueprintQuery(
        (dir) => new FileSystem(dir),
        c.get(Blueprints),
        c.get(SchemaValidator),
      ),
  )
  .register(ListBlueprintsEndpoint, (c) => new ListBlueprintsEndpoint(c.get(AllBlueprintsQuery)))
  .register(BlueprintByIdEndpoint, (c) => new BlueprintByIdEndpoint(c.get(BlueprintByIdQuery)))
  .register(
    ValidateBlueprintEndpoint,
    (c) => new ValidateBlueprintEndpoint(c.get(ValidateBlueprintQuery)),
  )
  /** Service queries */
  .register(AllServicesQuery, (c) => new AllServicesQuery(c.get(FileSystem)))
  .register(
    ListServicesEndpoint,
    (c) => new ListServicesEndpoint(c.get(AllServicesQuery)),
  )
  .register(ServiceByIdQuery, (c) => new ServiceByIdQuery(c.get(FileSystem)))
  .register(
    ServiceByIdEndpoint,
    (c) => new ServiceByIdEndpoint(c.get(ServiceByIdQuery)),
  )
  .register(ServicesByBlueprintQuery, (c) => new ServicesByBlueprintQuery(c.get(FileSystem)))
  .register(
    ServicesByBlueprintEndpoint,
    (c) => new ServicesByBlueprintEndpoint(c.get(ServicesByBlueprintQuery)),
  )
  /** Instance — cross-provider VM picker */
  .register(AllInstancesQuery, (c) => new AllInstancesQuery(c.get(FileSystem)))
  .register(
    ListInstancesEndpoint,
    (c) => new ListInstancesEndpoint(c.get(AllInstancesQuery)),
  )
  /**
   * Cluster — MCP endpoints.
   *
   * Same Query/Handler instances the cluster RPC endpoints already
   * receive — the MCP adapters call them directly (no JSON-RPC
   * envelope). The RPC and MCP rows are the two ports of the same
   * application use-case.
   */
  .register(
    ListClustersMcpEndpoint,
    (c) => new ListClustersMcpEndpoint(c.get(AllClustersQuery)),
  )
  .register(
    ClusterByIdMcpEndpoint,
    (c) => new ClusterByIdMcpEndpoint(c.get(ClusterByIdQuery)),
  )
  .register(
    ListProxmoxNodesMcpEndpoint,
    (c) => new ListProxmoxNodesMcpEndpoint(c.get(AllNodesQuery)),
  )
  .register(
    ListProxmoxVirtualMachinesMcpEndpoint,
    (c) => new ListProxmoxVirtualMachinesMcpEndpoint(c.get(AllVirtualMachinesQuery)),
  )
  .register(
    ListVirtualMachineTagsMcpEndpoint,
    (c) => new ListVirtualMachineTagsMcpEndpoint(c.get(AllVirtualMachineTagsQuery)),
  )
  .register(
    ListProvidersMcpEndpoint,
    (c) => new ListProvidersMcpEndpoint(c.get(AllProvidersQuery)),
  )
  .register(
    ListOperatingSystemsMcpEndpoint,
    (c) => new ListOperatingSystemsMcpEndpoint(c.get(AllOperatingSystemsQuery)),
  )
  .register(
    ListProxmoxConnectionsMcpEndpoint,
    (c) => new ListProxmoxConnectionsMcpEndpoint(c.get(AllConnectionsQuery)),
  )
  .register(
    ListImagesMcpEndpoint,
    (c) => new ListImagesMcpEndpoint(c.get(AllImagesQuery)),
  )
  .register(
    ProvisionPreviewMcpEndpoint,
    (c) => new ProvisionPreviewMcpEndpoint(c.get(ProvisionQuery)),
  )
  .register(
    PlanNodesMcpEndpoint,
    (c) =>
      new PlanNodesMcpEndpoint(
        c.get(PlanNodesHandler),
        c.get(ClusterByIdQuery),
      ),
  )
  .register(
    ApplyNodesMcpEndpoint,
    (c) =>
      new ApplyNodesMcpEndpoint(
        c.get(ApplyNodesHandler),
        c.get(ClusterByIdQuery),
      ),
  )
  .register(
    DestroyNodesMcpEndpoint,
    (c) =>
      new DestroyNodesMcpEndpoint(
        c.get(DestroyNodesHandler),
        c.get(ClusterByIdQuery),
      ),
  )
  .register(
    CreateImageMcpEndpoint,
    (c) =>
      new CreateImageMcpEndpoint(
        c.get(CreateImageHandler),
        c.get(ClusterByIdQuery),
      ),
  )
  .register(
    AcknowledgeInterruptionMcpEndpoint,
    (c) =>
      new AcknowledgeInterruptionMcpEndpoint(
        c.get(AcknowledgeInterruptionHandler),
        c.get(ClusterByIdQuery),
      ),
  )
  .register(
    RegisterNodeMcpEndpoint,
    (c) => new RegisterNodeMcpEndpoint(c.get(RegisterNodeHandler), c.get(ClusterByIdQuery)),
  )
  .register(
    RegisterVirtualMachineMcpEndpoint,
    (c) =>
      new RegisterVirtualMachineMcpEndpoint(
        c.get(RegisterVirtualMachineHandler),
        c.get(ClusterByIdQuery),
      ),
  )
  /**
   * Cluster — MCP write/read parity endpoints.
   */
  .register(
    RegisterClusterMcpEndpoint,
    (c) => new RegisterClusterMcpEndpoint(c.get(RegisterClusterHandler)),
  )
  .register(
    UnregisterClusterMcpEndpoint,
    (c) =>
      new UnregisterClusterMcpEndpoint(c.get(UnregisterClusterHandler), c.get(ClusterByIdQuery)),
  )
  .register(
    ConnectClusterMcpEndpoint,
    (c) => new ConnectClusterMcpEndpoint(c.get(ConnectClusterHandler), c.get(ClusterByIdQuery)),
  )
  .register(
    DisconnectClusterMcpEndpoint,
    (c) =>
      new DisconnectClusterMcpEndpoint(c.get(DisconnectClusterHandler), c.get(ClusterByIdQuery)),
  )
  .register(
    UpdateNodeMcpEndpoint,
    (c) => new UpdateNodeMcpEndpoint(c.get(UpdateNodeHandler), c.get(ClusterByIdQuery)),
  )
  .register(
    UnregisterNodeMcpEndpoint,
    (c) => new UnregisterNodeMcpEndpoint(c.get(UnregisterNodeHandler), c.get(ClusterByIdQuery)),
  )
  .register(
    UnregisterAllNodesMcpEndpoint,
    (c) =>
      new UnregisterAllNodesMcpEndpoint(c.get(UnregisterAllNodesHandler), c.get(ClusterByIdQuery)),
  )
  .register(
    AssignImageMcpEndpoint,
    (c) => new AssignImageMcpEndpoint(c.get(AssignImageHandler), c.get(ClusterByIdQuery)),
  )
  .register(
    UnassignImageMcpEndpoint,
    (c) => new UnassignImageMcpEndpoint(c.get(UnassignImageHandler), c.get(ClusterByIdQuery)),
  )
  .register(
    UpdateAssignedImageMcpEndpoint,
    (c) =>
      new UpdateAssignedImageMcpEndpoint(
        c.get(UpdateAssignedImageHandler),
        c.get(ClusterByIdQuery),
      ),
  )
  .register(
    UpdateVirtualMachineMcpEndpoint,
    (c) =>
      new UpdateVirtualMachineMcpEndpoint(
        c.get(UpdateVirtualMachineHandler),
        c.get(ClusterByIdQuery),
      ),
  )
  .register(
    UnregisterVirtualMachineMcpEndpoint,
    (c) =>
      new UnregisterVirtualMachineMcpEndpoint(
        c.get(UnregisterVirtualMachineHandler),
        c.get(ClusterByIdQuery),
      ),
  )
  .register(
    UnregisterAllVirtualMachinesMcpEndpoint,
    (c) =>
      new UnregisterAllVirtualMachinesMcpEndpoint(
        c.get(UnregisterAllVirtualMachinesHandler),
        c.get(ClusterByIdQuery),
      ),
  )
  .register(
    VirtualMachineByImageMcpEndpoint,
    (c) => new VirtualMachineByImageMcpEndpoint(c.get(VirtualMachineByImageQuery)),
  )
  .register(
    VirtualMachineMetricsMcpEndpoint,
    (c) => new VirtualMachineMetricsMcpEndpoint(c.get(VirtualMachineMetricsQuery)),
  )
  .register(
    StorageByNodeMcpEndpoint,
    (c) => new StorageByNodeMcpEndpoint(c.get(StoragesByNodeQuery)),
  )
  .register(
    TestProxmoxConnectionMcpEndpoint,
    (c) => new TestProxmoxConnectionMcpEndpoint(c.get(TestProxmoxConnectionQuery)),
  )
  /**
   * Station — MCP endpoints.
   * Same Query/Handler instances as the station RPC adapters.
   */
  .register(
    ListStationsMcpEndpoint,
    (c) => new ListStationsMcpEndpoint(c.get(AllStationsQuery)),
  )
  .register(
    StationByIdMcpEndpoint,
    (c) => new StationByIdMcpEndpoint(c.get(StationByIdQuery)),
  )
  .register(
    ListServicesMcpEndpoint,
    (c) => new ListServicesMcpEndpoint(c.get(AllServicesQuery)),
  )
  .register(
    ListInstancesMcpEndpoint,
    (c) => new ListInstancesMcpEndpoint(c.get(AllInstancesQuery)),
  )
  .register(
    InstallStationMcpEndpoint,
    (c) =>
      new InstallStationMcpEndpoint(
        c.get(InstallStationHandler),
        c.get(StationByIdQuery),
      ),
  )
  .register(
    UninstallStationMcpEndpoint,
    (c) =>
      new UninstallStationMcpEndpoint(
        c.get(UninstallStationHandler),
        c.get(StationByIdQuery),
      ),
  )
  /**
   * Station + Vault + Size — MCP write/read parity endpoints.
   */
  .register(
    RegisterStationMcpEndpoint,
    (c) => new RegisterStationMcpEndpoint(c.get(RegisterStationHandler)),
  )
  .register(
    UpdateStationMcpEndpoint,
    (c) => new UpdateStationMcpEndpoint(c.get(UpdateStationHandler), c.get(StationByIdQuery)),
  )
  .register(
    UnregisterStationMcpEndpoint,
    (c) =>
      new UnregisterStationMcpEndpoint(c.get(UnregisterStationHandler), c.get(StationByIdQuery)),
  )
  .register(
    RegisterServiceMcpEndpoint,
    (c) => new RegisterServiceMcpEndpoint(c.get(RegisterServiceHandler), c.get(StationByIdQuery)),
  )
  .register(
    UnregisterServiceMcpEndpoint,
    (c) =>
      new UnregisterServiceMcpEndpoint(c.get(UnregisterServiceHandler), c.get(StationByIdQuery)),
  )
  .register(
    ServicesByBlueprintMcpEndpoint,
    (c) => new ServicesByBlueprintMcpEndpoint(c.get(ServicesByBlueprintQuery)),
  )
  .register(
    ServiceByIdMcpEndpoint,
    (c) => new ServiceByIdMcpEndpoint(c.get(ServiceByIdQuery)),
  )
  .register(
    ServicesByStationMcpEndpoint,
    (c) => new ServicesByStationMcpEndpoint(c.get(ServicesByStationQuery)),
  )
  .register(
    CreateVaultMcpEndpoint,
    (c) => new CreateVaultMcpEndpoint(c.get(CreateVaultHandler)),
  )
  .register(
    DeleteVaultMcpEndpoint,
    (c) => new DeleteVaultMcpEndpoint(c.get(DeleteVaultHandler)),
  )
  .register(
    ListVaultsMcpEndpoint,
    (c) => new ListVaultsMcpEndpoint(c.get(AllVaultsQuery)),
  )
  .register(
    GenerateSecretMcpEndpoint,
    (c) =>
      new GenerateSecretMcpEndpoint(c.get(GenerateSecretHandler), c.get(SessionResolverAdapter)),
  )
  .register(
    DeleteSecretMcpEndpoint,
    (c) => new DeleteSecretMcpEndpoint(c.get(DeleteSecretHandler)),
  )
  .register(
    RenameVaultMcpEndpoint,
    (c) => new RenameVaultMcpEndpoint(c.get(RenameVaultHandler)),
  )
  .register(
    RenameSecretMcpEndpoint,
    (c) => new RenameSecretMcpEndpoint(c.get(RenameSecretHandler)),
  )
  .register(
    ListSecretsMcpEndpoint,
    (c) => new ListSecretsMcpEndpoint(c.get(AllSecretsQuery)),
  )
  .register(
    RegisterSizeMcpEndpoint,
    (c) => new RegisterSizeMcpEndpoint(c.get(RegisterSizeHandler)),
  )
  .register(
    UnregisterSizeMcpEndpoint,
    (c) => new UnregisterSizeMcpEndpoint(c.get(UnregisterSizeHandler)),
  )
  .register(
    CatalogRegisterImageMcpEndpoint,
    (c) => new CatalogRegisterImageMcpEndpoint(c.get(CatalogRegisterImageHandler)),
  )
  .register(
    CatalogUpdateImageMcpEndpoint,
    (c) => new CatalogUpdateImageMcpEndpoint(c.get(CatalogUpdateImageHandler)),
  )
  .register(
    CatalogUnregisterImageMcpEndpoint,
    (c) => new CatalogUnregisterImageMcpEndpoint(c.get(CatalogUnregisterImageHandler)),
  )
  .register(
    CatalogListImagesMcpEndpoint,
    (c) => new CatalogListImagesMcpEndpoint(c.get(AllCatalogImagesQuery)),
  )
  .register(
    ListSizesMcpEndpoint,
    (c) => new ListSizesMcpEndpoint(c.get(AllSizesQuery)),
  )
  /**
   * Blueprint + Executions + rpc.version — MCP endpoints.
   */
  .register(
    ListBlueprintsMcpEndpoint,
    (c) => new ListBlueprintsMcpEndpoint(c.get(AllBlueprintsQuery)),
  )
  .register(
    BlueprintByIdMcpEndpoint,
    (c) => new BlueprintByIdMcpEndpoint(c.get(BlueprintByIdQuery)),
  )
  .register(
    WatchExecutionMcpEndpoint,
    (c) => new WatchExecutionMcpEndpoint(c.get(InMemoryExecutions)),
  )
  .register(
    CancelExecutionMcpEndpoint,
    (c) => new CancelExecutionMcpEndpoint(c.get(InMemoryExecutions)),
  )
  .register(
    ListExecutionsMcpEndpoint,
    (c) => new ListExecutionsMcpEndpoint(c.get(InMemoryExecutions)),
  )
  // `core` is the same VERSION constant `src/rpc.ts` hands to
  // `new Server()` — single source of truth (`@server/build-info.ts`).
  .register(
    RpcVersionMcpEndpoint,
    () => new RpcVersionMcpEndpoint(VERSION),
  )
  /**
   * MCP resources. Each `devstation://…` URI owns its query directly,
   * mirroring the per-BC endpoint pattern.
   */
  .register(
    ClustersResource,
    (c) => new ClustersResource(c.get(AllClustersQuery)),
  )
  .register(
    StationsResource,
    (c) => new StationsResource(c.get(AllStationsQuery)),
  )
  .register(
    ServicesResource,
    (c) => new ServicesResource(c.get(AllServicesQuery)),
  )
  .register(
    BlueprintsResource,
    (c) => new BlueprintsResource(c.get(AllBlueprintsQuery)),
  )
  .register(
    ExecutionsResource,
    (c) => new ExecutionsResource(c.get(InMemoryExecutions)),
  )
  .build();
