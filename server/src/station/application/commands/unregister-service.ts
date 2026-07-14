import { Id as StationDomainId } from "@server/station/domain/models/id.ts";
import { Id as ServiceDomainId } from "@server/station/domain/models/service/id.ts";

export class UnregisterService {
  constructor(readonly stationId: string, readonly serviceId: string) {}

  stationDomainId(): StationDomainId {
    return new StationDomainId(this.stationId);
  }

  serviceDomainId(): ServiceDomainId {
    return new ServiceDomainId(this.serviceId);
  }
}
