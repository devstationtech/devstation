import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { RawStation } from "@server/station/application/queries/all/types/raw-station.ts";
import type { StationRecord } from "@server/station/application/queries/all/types/station-record.ts";
import {
  deriveServiceStats,
  deriveStationStatus,
} from "@server/station/application/queries/all/query.ts";

const STATIONS_FILE = "stations.json";

export class Query {
  constructor(private readonly fs: FileSystem) {}

  async execute(id: string): Promise<StationRecord | null> {
    const stations = await this.fs.readObjectsOf<RawStation>(STATIONS_FILE);
    const found = stations.find((s) => s.id === id);
    if (!found) return null;
    const services = found.services ?? [];
    return {
      id: found.id,
      name: found.name,
      description: found.description,
      status: deriveStationStatus(services),
      serviceCount: services.length,
      serviceStats: deriveServiceStats(services),
    };
  }
}
