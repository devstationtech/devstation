import type { Stations } from "@server/station/domain/ports/outbound/stations.ts";
import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import type { UnregisterService } from "@server/station/application/commands/unregister-service.ts";
import { StationNotFound } from "@server/station/domain/exceptions/station-not-found.ts";

export class UnregisterServiceHandler {
  constructor(
    private readonly stations: Stations,
    private readonly dispatcher: Dispatcher,
  ) {}

  async handle(command: UnregisterService): Promise<void> {
    const station = await this.stations.of(command.stationDomainId()).catch(() => {
      throw new StationNotFound();
    });
    station.unregisterService(command.serviceDomainId());
    await this.stations.save(station);
    await this.dispatcher.dispatch(station.events.pull());
  }
}
