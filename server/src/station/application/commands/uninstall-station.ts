import { Id as StationDomainId } from "@server/station/domain/models/id.ts";
import { Id as ServiceDomainId } from "@server/station/domain/models/service/id.ts";

/**
 * Tears down a chosen subset of services within a station as one session —
 * the mirror of `InstallStation`. Pass `[id]` for a single teardown or N ids
 * for a batch. The handler validates the reverse dependency closure (a host
 * service can't be uninstalled while a hosted dependent stays installed unless
 * it's torn down too) and runs in reverse topological order (dependents
 * before their hosts).
 */
export class UninstallStation {
  constructor(readonly stationId: string, readonly serviceIds: readonly string[]) {
    if (serviceIds.length === 0) {
      throw new Error("UninstallStation: serviceIds is required and must be non-empty.");
    }
  }

  stationDomainId(): StationDomainId {
    return new StationDomainId(this.stationId);
  }

  serviceDomainIds(): ServiceDomainId[] {
    return this.serviceIds.map((id) => new ServiceDomainId(id));
  }
}
