import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import type { Stations } from "@server/station/domain/ports/outbound/stations.ts";
import type { UnregisterStation } from "@server/station/application/commands/unregister-station.ts";

export class UnregisterStationHandler {
  constructor(
    private readonly stations: Stations,
    private readonly dispatcher: Dispatcher,
  ) {}

  async handle(command: UnregisterStation): Promise<void> {
    const op = command.toOperation();
    const station = await this.stations.of(op.id);
    station.unregister();
    await this.stations.remove(op.id);
    await this.dispatcher.dispatch(station.events.pull());
  }
}
