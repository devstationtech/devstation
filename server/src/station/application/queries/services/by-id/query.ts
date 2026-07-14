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

export class Query {
  constructor(private readonly fs: FileSystem) {}

  async execute(id: string): Promise<ServiceRecord | null> {
    const stations = await this.fs.readObjectsOf<RawStation>(STATIONS_FILE);
    const services = flatServicesFromStations(stations);
    const found = services.find((s) => s.id === id);
    if (!found) return null;
    const clusters = await this.fs.readObjectsOf<RawCluster>(CLUSTERS_FILE);
    const serviceById = new Map(services.map((s) => [s.id, s]));
    return projectService(found, serviceById, buildHostMap(clusters));
  }
}
