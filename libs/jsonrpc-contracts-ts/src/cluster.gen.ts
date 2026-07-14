// AUTO-GENERATED from @jsonrpc-schemas/cluster.openrpc.json
// Do not edit by hand — run `deno task contracts:codegen`.

/** Audit info captured when the cluster was first registered. */
export class ClusterCreation {
  constructor(
    readonly by: string,
    readonly hostname: string,
    readonly at: string,
  ) {}
}

/** Provider-specific topology summary for Proxmox clusters. */
export class ClusterProxmoxSummary {
  constructor(
    readonly nodeCount: number,
    readonly virtualMachineCount: number,
  ) {}
}

/** VM association row returned by cluster.proxmox.virtualMachine.byImage. */
export class VirtualMachineByImageRecord {
  constructor(
    readonly clusterId: string,
    readonly clusterName: string,
    readonly nodeId: string,
    readonly nodeName: string,
    readonly virtualMachineId: number,
    readonly virtualMachineName: string,
  ) {}
}

/** Read-side projection of a service running on a VM (service BC is the source of truth). */
export class ProxmoxVirtualMachineServiceRecord {
  constructor(
    readonly serviceId: string,
    readonly serviceName: string,
    readonly blueprint: string,
    readonly role: string,
    readonly installedAt: string,
  ) {}
}

/** Full VM read model: size/image ids + names, free tags, network, credential refs, resources, and service projection. */
export class ProxmoxVirtualMachineRecord {
  constructor(
    readonly id: number,
    readonly name: string,
    readonly tags: ReadonlyArray<string>,
    readonly sizeId: string,
    readonly sizeName: string,
    readonly image: string,
    readonly imageName: string,
    readonly imageOs: string,
    readonly ip: string,
    readonly gateway: string,
    readonly dns: string,
    readonly storage: string,
    readonly credentialVaultId: string,
    readonly usernameSecretId: string,
    readonly passwordSecretId: string,
    readonly resources: ProxmoxResources,
    readonly services: ReadonlyArray<ProxmoxVirtualMachineServiceRecord>,
  ) {}
}

/** Live storage entry on a Proxmox node. */
export class ProxmoxStorageRecord {
  constructor(
    readonly id: string,
    readonly type: string,
    readonly available: number,
    readonly total: number,
  ) {}
}

/** Storages of a Proxmox node + connectivity flag. `connected: false` means the entire response (including empty storages) is best-effort. */
export class StoragesByNodeRecord {
  constructor(
    readonly connected: boolean,
    readonly storages: ReadonlyArray<ProxmoxStorageRecord>,
  ) {}
}

/** Credential reference for a Proxmox node (vault + secret pair). */
export class ProxmoxCredentialRecord {
  constructor(
    readonly vaultId: string,
    readonly usernameSecretId: string,
    readonly passwordSecretId: string,
  ) {}
}

/** Per-node sum of resources reserved by registered VMs (independent of live API). */
export class ProxmoxLocalResources {
  constructor(
    readonly cpu: number,
    readonly ram: number,
    readonly disk: number,
  ) {}
}

/** Live snapshot of node resources fetched from the Proxmox API. */
export class ProxmoxLiveResources {
  constructor(
    readonly status: string,
    readonly cpuCores: number,
    readonly cpuPercent: number,
    readonly ramUsedGiB: number,
    readonly ramTotalGiB: number,
    readonly diskUsedGiB: number,
    readonly diskTotalGiB: number,
    readonly uptimeSeconds: number,
  ) {}
}

/** Resource summary for a Proxmox node — `live` is present when the cluster API is reachable. */
export class ProxmoxResources {
  constructor(
    readonly connected: boolean,
    readonly local: ProxmoxLocalResources,
    readonly live?: ProxmoxLiveResources,
  ) {}
}

/** Node row — static catalog info + optional live resources from the Proxmox API. */
export class ProxmoxNodeRecord {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly ip: string,
    readonly credential: ProxmoxCredentialRecord,
    readonly virtualMachineCount: number,
    readonly resources: ProxmoxResources,
    /** Node FSM lifecycle state (REGISTERED, PLAN_*, APPLY_STARTED, APPLY_SUCCEEDED, DESTROY_STARTED, …). The UI gates VM mutations while the node is in-flight. */
    readonly state: string,
    /** True when the node sits in a transient state (PLAN_STARTED / APPLY_STARTED / DESTROY_STARTED) with no live execution driving it — implies the last long-running operation was interrupted (e.g., process crash). The UI surfaces this so the operator can acknowledge via cluster.proxmox.nodes.acknowledgeInterruption and unwedge the node. */
    readonly interrupted: boolean,
  ) {}
}

/** Proxmox connection — host + vault credential reference + provisioning policy. */
export class ProxmoxConnectionRecord {
  constructor(
    readonly host: string,
    readonly vaultId: string,
    readonly secretId: string,
    readonly cloneStrategy: string,
    readonly parallelism: number,
  ) {}
}

/** One image assignment on a node — the catalog snapshot (name/os/sourceUrl) plus the materialization (virtualMachineId + storage). */
export class ClusterImageRecord {
  constructor(
    readonly imageId: string,
    readonly name: string,
    readonly os: string,
    readonly sourceUrl: string,
    readonly clusterId: string,
    readonly clusterName: string,
    readonly nodeId: string,
    readonly nodeName: string,
    readonly virtualMachineId: number,
    readonly storage: string,
  ) {}
}

/** Time-series point for a Proxmox VM — normalized from an RRD sample. */
export class ProxmoxVirtualMachineMetricPoint {
  constructor(
    readonly time: number,
    readonly cpuPercent: number,
    readonly ramUsedGiB: number,
    readonly ramTotalGiB: number,
    readonly diskReadMBs: number,
    readonly diskWriteMBs: number,
    readonly netInMBs: number,
    readonly netOutMBs: number,
  ) {}
}

/** Virtual-machine row shown in the provisioning preview. */
export class ProvisionVirtualMachineRecord {
  constructor(
    readonly id: number,
    readonly name: string,
    readonly tags: ReadonlyArray<string>,
    readonly image: string,
    readonly imageName: string,
    readonly ip: string,
    readonly gateway: string,
    readonly dns: string,
    readonly storage: string,
    readonly cpu: number,
    readonly ram: number,
    readonly disk: number,
  ) {}
}

/** Node row in the provisioning preview, carrying its VMs directly. */
export class ProvisionNodeRecord {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly ip: string,
    readonly hasCredential: boolean,
    readonly virtualMachines: ReadonlyArray<ProvisionVirtualMachineRecord>,
  ) {}
}

/** One distinct VM tag and how many VMs (across all clusters) use it. */
export class TagUsageRecord {
  constructor(
    readonly tag: string,
    readonly count: number,
  ) {}
}

/** Image-association row in the provisioning preview. */
export class ProvisionImageRecord {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly virtualMachineId: number,
    readonly nodeId: string,
    readonly nodeName: string,
  ) {}
}

/** Provisioning preview for a Proxmox cluster. */
export class ProvisionRecord {
  constructor(
    readonly clusterId: string,
    readonly clusterName: string,
    readonly connected: boolean,
    readonly nodes: ReadonlyArray<ProvisionNodeRecord>,
    readonly images: ReadonlyArray<ProvisionImageRecord>,
  ) {}
}

/** Tagged result of cluster.proxmox.testConnection — discriminated by `ok`. */
export type TestConnectionRecord = TestConnectionOk | TestConnectionFailed;

export class TestConnectionOk {
  readonly ok = true as const;

  constructor(
    readonly nodeCount: number,
  ) {}
}

export class TestConnectionFailed {
  readonly ok = false as const;

  constructor(
    readonly error: string,
  ) {}
}

/** Outcome of cluster.connection.bootstrapKey. */
export class BootstrapKeyRecord {
  constructor(
    /** True when the DevStation public key now reaches `~/.ssh/authorized_keys` on the remote (either we just appended it or it was already there). */
    readonly installed: boolean,
    /** True if the key was already present before we connected — nothing was written. False if we appended it now. */
    readonly alreadyPresent: boolean,
    /** True when the remote's authorized_keys is a symlink into Proxmox cluster filesystem (/etc/pve/priv/) — the install path went through the chmod-write-chmod dance. */
    readonly pmxcfsDetected?: boolean,
    /** Absolute path to the backup of authorized_keys created before any write. Absent when alreadyPresent is true (no backup needed). */
    readonly backupPath?: string,
  ) {}
}

/** Cluster summary for listing — includes provider tag, connection flag, version, creation audit and an optional provider-specific summary slot. */
export class ClusterRecord {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly provider: string,
    readonly connected: boolean,
    readonly version: number,
    readonly creation: ClusterCreation,
    readonly proxmox?: ClusterProxmoxSummary,
  ) {}
}

/** Ack of a long-running execution: the server returns the executionId so the UI can attach via execution.watch(executionId). */
export class ExecutionStarted {
  constructor(
    readonly executionId: string,
  ) {}
}

/** Tagged union of domain events published on a cluster's bus topic. Discriminated by `type`. Carries `eventId`/`occurredAt` for traceability and `clusterId`/`nodeId` for routing. Phase 2A enriches the completed/destroyed variants with `summary` payloads — for now the wire shape mirrors the in-process events one-to-one. */
export type ClusterEvent =
  | NodePlanStartedV1
  | NodePlanSucceededV1
  | NodePlanFailedV1
  | NodeApplyStartedV1
  | NodeApplySucceededV1
  | NodeApplyFailedV1
  | NodeDestroyStartedV1
  | NodeDestroySucceededV1
  | NodeDestroyFailedV1;

export class NodePlanStartedV1 {
  readonly type = "node-plan-started" as const;

  constructor(
    readonly eventId: string,
    readonly occurredAt: string,
    readonly clusterId: string,
    readonly nodeId: string,
  ) {}
}

export class NodePlanSucceededV1 {
  readonly type = "node-plan-succeeded" as const;

  constructor(
    readonly eventId: string,
    readonly occurredAt: string,
    readonly clusterId: string,
    readonly nodeId: string,
  ) {}
}

export class NodePlanFailedV1 {
  readonly type = "node-plan-failed" as const;

  constructor(
    readonly eventId: string,
    readonly occurredAt: string,
    readonly clusterId: string,
    readonly nodeId: string,
  ) {}
}

export class NodeApplyStartedV1 {
  readonly type = "node-apply-started" as const;

  constructor(
    readonly eventId: string,
    readonly occurredAt: string,
    readonly clusterId: string,
    readonly nodeId: string,
  ) {}
}

export class NodeApplySucceededV1 {
  readonly type = "node-apply-succeeded" as const;

  constructor(
    readonly eventId: string,
    readonly occurredAt: string,
    readonly clusterId: string,
    readonly nodeId: string,
  ) {}
}

export class NodeApplyFailedV1 {
  readonly type = "node-apply-failed" as const;

  constructor(
    readonly eventId: string,
    readonly occurredAt: string,
    readonly clusterId: string,
    readonly nodeId: string,
  ) {}
}

export class NodeDestroyStartedV1 {
  readonly type = "node-destroy-started" as const;

  constructor(
    readonly eventId: string,
    readonly occurredAt: string,
    readonly clusterId: string,
    readonly nodeId: string,
  ) {}
}

export class NodeDestroySucceededV1 {
  readonly type = "node-destroy-succeeded" as const;

  constructor(
    readonly eventId: string,
    readonly occurredAt: string,
    readonly clusterId: string,
    readonly nodeId: string,
  ) {}
}

export class NodeDestroyFailedV1 {
  readonly type = "node-destroy-failed" as const;

  constructor(
    readonly eventId: string,
    readonly occurredAt: string,
    readonly clusterId: string,
    readonly nodeId: string,
  ) {}
}

/** Params shape for the server-initiated `cluster.event` notification (mirrors ExecutionEventNotification). */
export class ClusterEventNotification {
  constructor(
    readonly clusterId: string,
    readonly event: ClusterEvent,
  ) {}
}

/** Typed result of cluster.proxmox.provisioning.plan. */
export class ClusterProvisioningPlanResult {
  constructor(
    readonly nodes: ReadonlyArray<ClusterProvisioningPlanNode>,
  ) {}
}

/** Plan change counts for a single (node, environment) pair. */
export class ClusterProvisioningPlanNode {
  constructor(
    readonly node: string,
    readonly environment: string,
    readonly toCreate: number,
    readonly toUpdate: number,
    readonly toDelete: number,
  ) {}
}

/** Typed result of cluster.proxmox.provisioning.apply. */
export class ClusterProvisioningApplyResult {
  constructor(
    readonly nodes: ReadonlyArray<ClusterProvisioningApplyNode>,
  ) {}
}

/** Apply resource counts for a single (node, environment) pair. */
export class ClusterProvisioningApplyNode {
  constructor(
    readonly node: string,
    readonly environment: string,
    readonly created: number,
    readonly updated: number,
    readonly deleted: number,
  ) {}
}

/** Typed result of cluster.proxmox.provisioning.destroy. */
export class ClusterProvisioningDestroyResult {
  constructor(
    readonly nodes: ReadonlyArray<ClusterProvisioningDestroyNode>,
  ) {}
}

/** Destroy deletion count for a single (node, environment) pair. */
export class ClusterProvisioningDestroyNode {
  constructor(
    readonly node: string,
    readonly environment: string,
    readonly deleted: number,
  ) {}
}

export type Ack = Record<string, unknown>;

/** Request payload for `cluster.subscribe`. */
export interface ClusterSubscribeRequest {
  readonly sessionId: string;
  readonly clusterId: string;
}

/** Response payload of `cluster.subscribe`. */
export type ClusterSubscribeResponse = Ack;

/** Request payload for `cluster.proxmox.virtualMachine.byImage`. */
export interface ClusterProxmoxVirtualMachineByImageRequest {
  readonly sessionId: string;
  readonly imageId: string;
}

/** Response payload of `cluster.proxmox.virtualMachine.byImage`. */
export type ClusterProxmoxVirtualMachineByImageResponse = ReadonlyArray<
  VirtualMachineByImageRecord
>;

/** Request payload for `cluster.proxmox.virtualMachine.metrics`. */
export interface ClusterProxmoxVirtualMachineMetricsRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly nodeId: string;
  readonly virtualMachineId: number;
  readonly timeframe: "hour" | "day" | "week" | "month" | "year";
}

/** Response payload of `cluster.proxmox.virtualMachine.metrics`. */
export type ClusterProxmoxVirtualMachineMetricsResponse = ReadonlyArray<
  ProxmoxVirtualMachineMetricPoint
>;

/** Request payload for `cluster.proxmox.provision`. */
export interface ClusterProxmoxProvisionRequest {
  readonly sessionId: string;
  readonly clusterId: string;
}

/** Response payload of `cluster.proxmox.provision`. */
export type ClusterProxmoxProvisionResponse = ProvisionRecord;

/** Request payload for `cluster.proxmox.testConnection`. */
export interface ClusterProxmoxTestConnectionRequest {
  readonly sessionId: string;
  readonly host: string;
  readonly token: string;
}

/** Response payload of `cluster.proxmox.testConnection`. */
export type ClusterProxmoxTestConnectionResponse = TestConnectionRecord;

/** Request payload for `cluster.connection.bootstrapKey`. */
export interface ClusterConnectionBootstrapKeyRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly nodeId: string;
}

/** Response payload of `cluster.connection.bootstrapKey`. */
export type ClusterConnectionBootstrapKeyResponse = BootstrapKeyRecord;

/** Request payload for `cluster.byId`. */
export interface ClusterByIdRequest {
  readonly sessionId: string;
  readonly id: string;
}

/** Response payload of `cluster.byId`. */
export type ClusterByIdResponse = ClusterRecord;

/** Request payload for `cluster.list`. */
export interface ClusterListRequest {
  readonly sessionId: string;
}

/** Response payload of `cluster.list`. */
export type ClusterListResponse = ReadonlyArray<ClusterRecord>;

/** Request payload for `cluster.providers.list`. */
export interface ClusterProvidersListRequest {
  readonly sessionId: string;
}

/** Response payload of `cluster.providers.list`. */
export type ClusterProvidersListResponse = ReadonlyArray<string>;

/** Request payload for `cluster.operatingSystems.list`. */
export interface ClusterOperatingSystemsListRequest {
  readonly sessionId: string;
}

/** Response payload of `cluster.operatingSystems.list`. */
export type ClusterOperatingSystemsListResponse = ReadonlyArray<string>;

/** Request payload for `cluster.proxmox.virtualMachine.tags`. */
export interface ClusterProxmoxVirtualMachineTagsRequest {
  readonly sessionId: string;
}

/** Response payload of `cluster.proxmox.virtualMachine.tags`. */
export type ClusterProxmoxVirtualMachineTagsResponse = {
  readonly tags: ReadonlyArray<TagUsageRecord>;
};

/** Request payload for `cluster.proxmox.virtualMachine.list`. */
export interface ClusterProxmoxVirtualMachineListRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly nodeId: string;
}

/** Response payload of `cluster.proxmox.virtualMachine.list`. */
export type ClusterProxmoxVirtualMachineListResponse = ReadonlyArray<ProxmoxVirtualMachineRecord>;

/** Request payload for `cluster.proxmox.storage.byNode`. */
export interface ClusterProxmoxStorageByNodeRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly nodeId: string;
}

/** Response payload of `cluster.proxmox.storage.byNode`. */
export type ClusterProxmoxStorageByNodeResponse = StoragesByNodeRecord;

/** Request payload for `cluster.proxmox.nodes.list`. */
export interface ClusterProxmoxNodesListRequest {
  readonly sessionId: string;
  readonly clusterId: string;
}

/** Response payload of `cluster.proxmox.nodes.list`. */
export type ClusterProxmoxNodesListResponse = ReadonlyArray<ProxmoxNodeRecord>;

/** Request payload for `cluster.proxmox.connections.list`. */
export interface ClusterProxmoxConnectionsListRequest {
  readonly sessionId: string;
  readonly clusterId: string;
}

/** Response payload of `cluster.proxmox.connections.list`. */
export type ClusterProxmoxConnectionsListResponse = ReadonlyArray<ProxmoxConnectionRecord>;

/** Request payload for `cluster.images.list`. */
export interface ClusterImagesListRequest {
  readonly sessionId: string;
  readonly clusterId?: string | null;
}

/** Response payload of `cluster.images.list`. */
export type ClusterImagesListResponse = ReadonlyArray<ClusterImageRecord>;

/** Request payload for `cluster.proxmox.virtualMachine.unregisterAll`. */
export interface ClusterProxmoxVirtualMachineUnregisterAllRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly nodeId: string;
}

/** Response payload of `cluster.proxmox.virtualMachine.unregisterAll`. */
export type ClusterProxmoxVirtualMachineUnregisterAllResponse = Ack;

/** Request payload for `cluster.proxmox.virtualMachine.unregister`. */
export interface ClusterProxmoxVirtualMachineUnregisterRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly nodeId: string;
  readonly id: number;
}

/** Response payload of `cluster.proxmox.virtualMachine.unregister`. */
export type ClusterProxmoxVirtualMachineUnregisterResponse = Ack;

/** Request payload for `cluster.proxmox.virtualMachine.update`. */
export interface ClusterProxmoxVirtualMachineUpdateRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly nodeId: string;
  readonly id: number;
  readonly name: string;
  readonly size: string;
  readonly image: string;
  readonly ip: string;
  readonly gateway: string;
  readonly dns: string;
  readonly storage: string;
  readonly cpu: number;
  readonly ram: number;
  readonly disk: number;
  readonly credentialVaultId: string;
  readonly usernameSecretId: string;
  readonly passwordSecretId: string;
  readonly tags?: ReadonlyArray<string>;
}

/** Response payload of `cluster.proxmox.virtualMachine.update`. */
export type ClusterProxmoxVirtualMachineUpdateResponse = Ack;

/** Request payload for `cluster.proxmox.virtualMachine.register`. */
export interface ClusterProxmoxVirtualMachineRegisterRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly nodeId: string;
  readonly name: string;
  readonly id: number;
  readonly size: string;
  readonly image: string;
  readonly ip: string;
  readonly gateway: string;
  readonly dns: string;
  readonly storage: string;
  readonly cpu: number;
  readonly ram: number;
  readonly disk: number;
  readonly credentialVaultId: string;
  readonly usernameSecretId: string;
  readonly passwordSecretId: string;
  readonly tags?: ReadonlyArray<string>;
}

/** Response payload of `cluster.proxmox.virtualMachine.register`. */
export type ClusterProxmoxVirtualMachineRegisterResponse = Ack;

/** Request payload for `cluster.proxmox.images.updateAssigned`. */
export interface ClusterProxmoxImagesUpdateAssignedRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly nodeId: string;
  readonly imageId: string;
  readonly virtualMachineId: number;
  readonly storage: string;
}

/** Response payload of `cluster.proxmox.images.updateAssigned`. */
export type ClusterProxmoxImagesUpdateAssignedResponse = Ack;

/** Request payload for `cluster.proxmox.images.unassign`. */
export interface ClusterProxmoxImagesUnassignRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly nodeId: string;
  readonly imageId: string;
}

/** Response payload of `cluster.proxmox.images.unassign`. */
export type ClusterProxmoxImagesUnassignResponse = Ack;

/** Request payload for `cluster.proxmox.images.assign`. */
export interface ClusterProxmoxImagesAssignRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly nodeId: string;
  readonly imageId: string;
  readonly name: string;
  readonly os: string;
  readonly sourceUrl: string;
  readonly virtualMachineId: number;
  readonly storage: string;
}

/** Response payload of `cluster.proxmox.images.assign`. */
export type ClusterProxmoxImagesAssignResponse = Ack;

/** Request payload for `cluster.proxmox.nodes.unregisterAll`. */
export interface ClusterProxmoxNodesUnregisterAllRequest {
  readonly sessionId: string;
  readonly clusterId: string;
}

/** Response payload of `cluster.proxmox.nodes.unregisterAll`. */
export type ClusterProxmoxNodesUnregisterAllResponse = Ack;

/** Request payload for `cluster.proxmox.nodes.unregister`. */
export interface ClusterProxmoxNodesUnregisterRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly nodeId: string;
}

/** Response payload of `cluster.proxmox.nodes.unregister`. */
export type ClusterProxmoxNodesUnregisterResponse = Ack;

/** Request payload for `cluster.proxmox.nodes.acknowledgeInterruption`. */
export interface ClusterProxmoxNodesAcknowledgeInterruptionRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly nodeId: string;
}

/** Response payload of `cluster.proxmox.nodes.acknowledgeInterruption`. */
export type ClusterProxmoxNodesAcknowledgeInterruptionResponse = Ack;

/** Request payload for `cluster.proxmox.nodes.update`. */
export interface ClusterProxmoxNodesUpdateRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly nodeId: string;
  readonly name: string;
  readonly ip: string;
  readonly vaultId: string;
  readonly usernameSecretId: string;
  readonly passwordSecretId: string;
}

/** Response payload of `cluster.proxmox.nodes.update`. */
export type ClusterProxmoxNodesUpdateResponse = Ack;

/** Request payload for `cluster.proxmox.nodes.register`. */
export interface ClusterProxmoxNodesRegisterRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly name: string;
  readonly ip: string;
  readonly vaultId: string;
  readonly usernameSecretId: string;
  readonly passwordSecretId: string;
}

/** Response payload of `cluster.proxmox.nodes.register`. */
export type ClusterProxmoxNodesRegisterResponse = Ack;

/** Request payload for `cluster.proxmox.disconnect`. */
export interface ClusterProxmoxDisconnectRequest {
  readonly sessionId: string;
  readonly clusterId: string;
}

/** Response payload of `cluster.proxmox.disconnect`. */
export type ClusterProxmoxDisconnectResponse = Ack;

/** Request payload for `cluster.proxmox.connect`. */
export interface ClusterProxmoxConnectRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly host: string;
  readonly vaultId: string;
  readonly secretId: string;
  readonly cloneStrategy?: string;
  readonly parallelism?: number;
}

/** Response payload of `cluster.proxmox.connect`. */
export type ClusterProxmoxConnectResponse = Ack;

/** Request payload for `cluster.unregister`. */
export interface ClusterUnregisterRequest {
  readonly sessionId: string;
  readonly id: string;
}

/** Response payload of `cluster.unregister`. */
export type ClusterUnregisterResponse = Ack;

/** Request payload for `cluster.register`. */
export interface ClusterRegisterRequest {
  readonly sessionId: string;
  readonly name: string;
  readonly user: string;
  readonly hostname: string;
}

/** Response payload of `cluster.register`. */
export type ClusterRegisterResponse = Ack;

/** Request payload for `cluster.proxmox.provisioning.plan`. */
export interface ClusterProxmoxProvisioningPlanRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly nodeIds: ReadonlyArray<string>;
}

/** Response payload of `cluster.proxmox.provisioning.plan`. */
export type ClusterProxmoxProvisioningPlanResponse = ExecutionStarted;

/** Request payload for `cluster.proxmox.provisioning.apply`. */
export interface ClusterProxmoxProvisioningApplyRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly nodeIds: ReadonlyArray<string>;
}

/** Response payload of `cluster.proxmox.provisioning.apply`. */
export type ClusterProxmoxProvisioningApplyResponse = ExecutionStarted;

/** Request payload for `cluster.proxmox.provisioning.destroy`. */
export interface ClusterProxmoxProvisioningDestroyRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly nodeIds: ReadonlyArray<string>;
}

/** Response payload of `cluster.proxmox.provisioning.destroy`. */
export type ClusterProxmoxProvisioningDestroyResponse = ExecutionStarted;

/** Request payload for `cluster.proxmox.images.create`. */
export interface ClusterProxmoxImagesCreateRequest {
  readonly sessionId: string;
  readonly clusterId: string;
  readonly nodeId: string;
  readonly imageId: string;
}

/** Response payload of `cluster.proxmox.images.create`. */
export type ClusterProxmoxImagesCreateResponse = Ack;
