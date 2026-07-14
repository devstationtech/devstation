// AUTO-GENERATED from @jsonrpc-schemas/station.openrpc.json
// Do not edit by hand — run `deno task contracts:codegen`.

export type ServiceInputs = Record<string, string | number | boolean>;

export type ServiceSecrets = Record<string, string>;

/** Standalone-installation instance: declares the role being installed and the target host + credentials. */
export class ServiceInstance {
  constructor(
    readonly role: string,
    readonly host: string,
    readonly credentialVaultId: string,
    readonly usernameSecretId: string,
    readonly passwordSecretId: string,
  ) {}
}

/** Standalone installation targets. Must be null when `host` is provided (hosted blueprint). */
export type ServiceInstanceList = ReadonlyArray<ServiceInstance> | null;

/** Flattened service projection across stations. */
export class StationServiceRecord {
  constructor(
    readonly id: string,
    readonly stationId: string,
    readonly name: string,
    readonly blueprint: string,
    readonly status: string,
    /** Why the last install FAILED; null outside FAILED. Survives restarts. */
    readonly failureReason: string | null,
    readonly instances: ReadonlyArray<StationServiceInstanceRecord>,
    readonly host: StationServiceHostRecord,
    readonly installations: ReadonlyArray<StationServiceInstallationRecord>,
    readonly lastInstalledAt: string | null,
  ) {}
}

export class StationServiceInstanceRecord {
  constructor(
    readonly role: string,
    readonly host: string,
    readonly name: string,
    readonly provider: string,
    readonly cluster: string,
    readonly node: string,
  ) {}
}

/** Resolved host reference. Null for standalone services. */
export type StationServiceHostRecord = {
  readonly serviceId: string;
  readonly serviceName: string;
  readonly serviceBlueprint: string;
  readonly role: string;
} | null;

export class StationServiceInstallationRecord {
  constructor(
    readonly role: string,
    readonly host: string,
    readonly blueprintVersion: string,
    readonly outputs: Record<string, string>,
    readonly at: string,
  ) {}
}

/** Cross-provider VM annotated with occupancy info from the Service domain. */
export class StationInstanceRecord {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly host: string,
    readonly os: string,
    readonly provider: string,
    readonly cluster: StationInstanceClusterRef,
    readonly node: StationInstanceNodeRef,
    readonly specs: StationInstanceSpecs,
    readonly credentialVaultId: string,
    readonly usernameSecretId: string,
    readonly passwordSecretId: string,
    readonly busy: boolean,
    readonly busyBy: StationInstanceBusyBy,
  ) {}
}

export class StationInstanceClusterRef {
  constructor(
    readonly id: string,
    readonly name: string,
  ) {}
}

export class StationInstanceNodeRef {
  constructor(
    readonly id: string,
    readonly name: string,
  ) {}
}

export class StationInstanceSpecs {
  constructor(
    readonly cpu: number,
    readonly ram: number,
    readonly disk: number,
  ) {}
}

/** Occupancy reference. Null when the VM is not occupied by any service. */
export type StationInstanceBusyBy = {
  readonly serviceId: string;
  readonly serviceName: string;
  readonly role: string;
} | null;

/** Listing-friendly view of a station: derived status + service count + per-status stats. */
export class StationRecord {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly description: string,
    readonly status: string,
    readonly serviceCount: number,
    readonly serviceStats: StationServiceStats,
  ) {}
}

/** Per-status counts derived from the station's services. */
export class StationServiceStats {
  constructor(
    readonly registered: number,
    readonly installing: number,
    readonly installed: number,
    readonly failed: number,
    readonly aborted: number,
  ) {}
}

/** Ack of a long-running execution: the server returns the executionId so the UI can attach via execution.watch(executionId). */
export class ExecutionStarted {
  constructor(
    readonly executionId: string,
  ) {}
}

/** Reference to a host service (for hosted blueprints). Must be null when `instances` is provided. */
export type ServiceHostRef = { readonly serviceId: string; readonly role: string } | null;

export type Ack = Record<string, unknown>;

/** Request payload for `station.services.byStation`. */
export interface StationServicesByStationRequest {
  readonly sessionId: string;
  readonly stationId: string;
}

/** Response payload of `station.services.byStation`. */
export type StationServicesByStationResponse = ReadonlyArray<StationServiceRecord>;

/** Request payload for `station.services.byId`. */
export interface StationServicesByIdRequest {
  readonly sessionId: string;
  readonly id: string;
}

/** Response payload of `station.services.byId`. */
export type StationServicesByIdResponse = StationServiceRecord;

/** Request payload for `station.services.byBlueprint`. */
export interface StationServicesByBlueprintRequest {
  readonly sessionId: string;
  readonly blueprint: string;
}

/** Response payload of `station.services.byBlueprint`. */
export type StationServicesByBlueprintResponse = ReadonlyArray<StationServiceRecord>;

/** Request payload for `station.services.list`. */
export interface StationServicesListRequest {
  readonly sessionId: string;
}

/** Response payload of `station.services.list`. */
export type StationServicesListResponse = ReadonlyArray<StationServiceRecord>;

/** Request payload for `station.instances.list`. */
export interface StationInstancesListRequest {
  readonly sessionId: string;
}

/** Response payload of `station.instances.list`. */
export type StationInstancesListResponse = ReadonlyArray<StationInstanceRecord>;

/** Request payload for `station.byId`. */
export interface StationByIdRequest {
  readonly sessionId: string;
  readonly id: string;
}

/** Response payload of `station.byId`. */
export type StationByIdResponse = StationRecord;

/** Request payload for `station.list`. */
export interface StationListRequest {
  readonly sessionId: string;
}

/** Response payload of `station.list`. */
export type StationListResponse = ReadonlyArray<StationRecord>;

/** Request payload for `station.install`. */
export interface StationInstallRequest {
  readonly sessionId: string;
  readonly stationId: string;
  readonly serviceIds: ReadonlyArray<string>;
}

/** Response payload of `station.install`. */
export type StationInstallResponse = ExecutionStarted;

/** Request payload for `station.uninstall`. */
export interface StationUninstallRequest {
  readonly sessionId: string;
  readonly stationId: string;
  readonly serviceIds: ReadonlyArray<string>;
}

/** Response payload of `station.uninstall`. */
export type StationUninstallResponse = ExecutionStarted;

/** Request payload for `station.services.unregister`. */
export interface StationServicesUnregisterRequest {
  readonly sessionId: string;
  readonly stationId: string;
  readonly serviceId: string;
}

/** Response payload of `station.services.unregister`. */
export type StationServicesUnregisterResponse = Ack;

/** Request payload for `station.services.register`. */
export interface StationServicesRegisterRequest {
  readonly sessionId: string;
  readonly stationId: string;
  readonly name: string;
  readonly blueprint: string;
  readonly vaultId: string;
  readonly inputs: ServiceInputs;
  readonly secrets: ServiceSecrets;
  readonly user: string;
  readonly hostname: string;
  readonly instances: ServiceInstanceList;
  readonly host: ServiceHostRef;
}

/** Response payload of `station.services.register`. */
export type StationServicesRegisterResponse = Ack;

/** Request payload for `station.unregister`. */
export interface StationUnregisterRequest {
  readonly sessionId: string;
  readonly stationId: string;
}

/** Response payload of `station.unregister`. */
export type StationUnregisterResponse = Ack;

/** Request payload for `station.update`. */
export interface StationUpdateRequest {
  readonly sessionId: string;
  readonly stationId: string;
  readonly name: string;
  readonly description: string;
}

/** Response payload of `station.update`. */
export type StationUpdateResponse = Ack;

/** Request payload for `station.register`. */
export interface StationRegisterRequest {
  readonly sessionId: string;
  readonly name: string;
  readonly description: string;
  readonly user: string;
  readonly hostname: string;
}

/** Response payload of `station.register`. */
export type StationRegisterResponse = Ack;
