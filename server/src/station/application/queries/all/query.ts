import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { RawStation } from "@server/station/application/queries/all/types/raw-station.ts";
import type { StationRecord } from "@server/station/application/queries/all/types/station-record.ts";

const STATIONS_FILE = "stations.json";

type ServiceLike = { status: string };

/**
 * Derives station-level status from its services. Mirrors the logic in
 * Station.status getter on the write side, kept duplicated here so the
 * query stays self-contained (no domain reach-through).
 */
export function deriveStationStatus(services: ReadonlyArray<ServiceLike>): string {
  if (services.length === 0) return "REGISTERED";
  const statuses = services.map((s) => s.status);
  if (statuses.some((s) => s === "INSTALLING")) return "INSTALLING";
  if (statuses.every((s) => s === "INSTALLED")) return "INSTALLED";
  if (statuses.some((s) => s === "FAILED")) return "FAILED";
  if (statuses.some((s) => s === "ABORTED")) return "ABORTED";
  return "REGISTERED";
}

export function deriveServiceStats(
  services: ReadonlyArray<ServiceLike>,
): StationRecord["serviceStats"] {
  const stats = { registered: 0, installing: 0, installed: 0, failed: 0, aborted: 0 };
  for (const s of services) {
    if (s.status === "REGISTERED") stats.registered++;
    else if (s.status === "INSTALLING") stats.installing++;
    else if (s.status === "INSTALLED") stats.installed++;
    else if (s.status === "FAILED") stats.failed++;
    else if (s.status === "ABORTED") stats.aborted++;
  }
  return stats;
}

export class Query {
  constructor(private readonly fs: FileSystem) {}

  async execute(): Promise<StationRecord[]> {
    const stations = await this.fs.readObjectsOf<RawStation>(STATIONS_FILE);
    // Map legacy status values written before the deploy->install rename.
    const legacy: Record<string, string> = {
      DEPLOYING: "INSTALLING",
      DEPLOYED: "INSTALLED",
      DESTROYING: "UNINSTALLING",
      DESTROYED: "UNINSTALLED",
      DESTROY_FAILED: "UNINSTALL_FAILED",
    };
    return stations.map((s) => {
      const services = (s.services ?? []).map((sv) => ({
        ...sv,
        status: legacy[sv.status] ?? sv.status,
      }));
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        status: deriveStationStatus(services),
        serviceCount: services.length,
        serviceStats: deriveServiceStats(services),
      };
    });
  }
}
