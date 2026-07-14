import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import type { Stations } from "@server/station/domain/ports/outbound/stations.ts";
import { StationAlreadyExists } from "@server/station/domain/exceptions/station-already-exists.ts";
import type { UpdateStation } from "@server/station/application/commands/update-station.ts";

export class UpdateStationHandler {
  constructor(
    private readonly stations: Stations,
    private readonly dispatcher: Dispatcher,
  ) {}

  async handle(command: UpdateStation): Promise<void> {
    const op = command.toOperation();
    const station = await this.stations.of(op.id);

    // Name uniqueness: only check if the name is actually changing — same
    // name on the same station is a no-op, not a conflict.
    if (op.name.value !== station.name.value) {
      const conflict = await this.stations.byName(op.name);
      if (conflict && conflict.id.value !== station.id.value) {
        throw new StationAlreadyExists();
      }
    }

    station.update(op.name, op.description);
    await this.stations.save(station);
    await this.dispatcher.dispatch(station.events.pull());
  }
}
