import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { RawService } from "@server/station/application/queries/services/all/types/raw-service.ts";
import type { RawStation } from "@server/station/application/queries/services/all/types/raw-station.ts";
import type { RawCluster } from "@server/station/application/queries/services/all/types/raw-cluster.ts";
import type {
  ServiceHostRecord,
  ServiceRecord,
} from "@server/station/application/queries/services/all/types/service-record.ts";

const STATIONS_FILE = "stations.json";
const CLUSTERS_FILE = "clusters.json";

type HostInfo = {
  name: string;
  provider: string;
  cluster: string;
  node: string;
};

/** Service flattened from a station with its parent station id attached. */
export type FlatService = RawService & { stationId: string };

export class Query {
  constructor(private readonly fs: FileSystem) {}

  async execute(): Promise<ServiceRecord[]> {
    const stations = await this.fs.readObjectsOf<RawStation>(STATIONS_FILE);
    const clusters = await this.fs.readObjectsOf<RawCluster>(CLUSTERS_FILE);
    const services = flatServicesFromStations(stations);
    const hostMap = buildHostMap(clusters);
    const serviceById = new Map(services.map((s) => [s.id, s]));
    return services.map((s) => projectService(s, serviceById, hostMap));
  }
}

// Back-compat with state written before the deploy->install rename:
// `deployments` -> `installations`, and the two legacy status values.
const LEGACY_STATUS: Record<string, string> = {
  DEPLOYING: "INSTALLING",
  DEPLOYED: "INSTALLED",
  DESTROYING: "UNINSTALLING",
  DESTROYED: "UNINSTALLED",
  DESTROY_FAILED: "UNINSTALL_FAILED",
};

export function flatServicesFromStations(stations: RawStation[]): FlatService[] {
  const out: FlatService[] = [];
  for (const station of stations) {
    for (const service of station.services ?? []) {
      const legacy = service as RawService & { deployments?: RawService["installations"] };
      out.push({
        ...service,
        installations: service.installations ?? legacy.deployments ?? [],
        status: LEGACY_STATUS[service.status] ?? service.status,
        stationId: station.id,
      });
    }
  }
  return out;
}

export function buildHostMap(clusters: RawCluster[]): Map<string, HostInfo> {
  const map = new Map<string, HostInfo>();
  for (const cluster of clusters) {
    for (const node of cluster.nodes) {
      for (const vm of node.virtualMachines) {
        map.set(vm.address, {
          name: vm.name,
          provider: cluster.provider,
          cluster: cluster.name,
          node: node.name,
        });
      }
    }
  }
  return map;
}

export function projectService(
  s: FlatService,
  serviceById: Map<string, FlatService>,
  hostMap: Map<string, HostInfo>,
): ServiceRecord {
  const lastInstalledAt = s.installations.length === 0 ? null : s.installations
    .map((d) => d.at)
    .sort()
    .at(-1) ?? null;

  let host: ServiceHostRecord | null = null;
  if (s.host) {
    const hostService = serviceById.get(s.host.serviceId);
    host = {
      serviceId: s.host.serviceId,
      serviceName: hostService?.name ?? s.host.serviceId,
      serviceBlueprint: hostService?.blueprint ?? "",
      role: s.host.role,
    };
  }

  return {
    id: s.id,
    stationId: s.stationId,
    name: s.name,
    blueprint: s.blueprint,
    status: s.status,
    failureReason: s.failureReason ?? null,
    instances: s.instances.map((i) => {
      const info = hostMap.get(i.host);
      return {
        role: i.role,
        host: i.host,
        name: info?.name ?? "",
        provider: info?.provider ?? "",
        cluster: info?.cluster ?? "",
        node: info?.node ?? "",
      };
    }),
    host,
    installations: s.installations.map((d) => ({
      role: d.role,
      host: d.host,
      blueprintVersion: d.result.blueprint.version,
      outputs: { ...d.result.outputs },
      at: d.at,
    })),
    lastInstalledAt,
  };
}
