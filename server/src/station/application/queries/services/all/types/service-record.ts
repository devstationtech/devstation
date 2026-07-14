export type ServiceInstanceRecord = {
  role: string;
  host: string;
  /** VM name in its provider; empty if the host can't be resolved against any cluster. */
  name: string;
  provider: string;
  cluster: string;
  node: string;
};

export type ServiceHostRecord = {
  /** Id of the host service this hosted service runs on top of. */
  serviceId: string;
  /** Resolved name of the host service (display only). */
  serviceName: string;
  /** Blueprint of the host service (display only). */
  serviceBlueprint: string;
  /** Role of the host service this hosted service binds to. */
  role: string;
};

export type ServiceInstallationRecord = {
  role: string;
  host: string;
  blueprintVersion: string;
  outputs: Record<string, string>;
  at: string;
};

export type ServiceRecord = {
  id: string;
  stationId: string;
  name: string;
  blueprint: string;
  status: string;
  /** Why the last install FAILED; null outside FAILED. */
  failureReason: string | null;
  /** Standalone services: VMs assigned to each role. Empty for hosted services. */
  instances: ServiceInstanceRecord[];
  /** Hosted services: host reference. Null for standalone services. */
  host: ServiceHostRecord | null;
  installations: ServiceInstallationRecord[];
  lastInstalledAt: string | null;
};
