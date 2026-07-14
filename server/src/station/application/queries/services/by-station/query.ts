import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { RawStation } from "@server/station/application/queries/services/all/types/raw-station.ts";
import type { RawCluster } from "@server/station/application/queries/services/all/types/raw-cluster.ts";
import type { ServiceRecord } from "@server/station/application/queries/services/all/types/service-record.ts";
import {
  buildHostMap,
  flatServicesFromStations,
  projectService,
} from "@server/station/application/queries/services/all/query.ts";

const STATIONS_FILE = "stations.json";
const CLUSTERS_FILE = "clusters.json";

/**
 * Lists services that belong to a given station. Used by the station detail
 * screen to show which services it owns and the station orchestrator to
 * decide what to install.
 */
export class Query {
  constructor(private readonly fs: FileSystem) {}

  async execute(stationId: string): Promise<ServiceRecord[]> {
    const stations = await this.fs.readObjectsOf<RawStation>(STATIONS_FILE);
    const services = flatServicesFromStations(stations);
    const clusters = await this.fs.readObjectsOf<RawCluster>(CLUSTERS_FILE);
    const serviceById = new Map(services.map((s) => [s.id, s]));
    const hostMap = buildHostMap(clusters);
    return services
      .filter((s) => s.stationId === stationId)
      .map((s) => projectService(s, serviceById, hostMap));
  }
}
