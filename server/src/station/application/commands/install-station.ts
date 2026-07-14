import { Id as StationDomainId } from "@server/station/domain/models/id.ts";
import { Id as ServiceDomainId } from "@server/station/domain/models/service/id.ts";

/**
 * Installs a chosen subset of services within a station as one session.
 * Granularity is per-service: pass `[id]` for a single reinstall or N ids
 * for a multi-service rollout. The handler validates the dependency closure
 * (any hosted service in the selection requires its host to be either in
 * the selection too or already INSTALLED) and runs in topological order.
 */
export class InstallStation {
  constructor(readonly stationId: string, readonly serviceIds: readonly string[]) {
    if (serviceIds.length === 0) {
      throw new Error("InstallStation: serviceIds is required and must be non-empty.");
    }
  }

  stationDomainId(): StationDomainId {
    return new StationDomainId(this.stationId);
  }

  serviceDomainIds(): ServiceDomainId[] {
    return this.serviceIds.map((id) => new ServiceDomainId(id));
  }
}
