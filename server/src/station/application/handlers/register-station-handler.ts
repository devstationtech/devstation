import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import type { Stations } from "@server/station/domain/ports/outbound/stations.ts";
import { Station } from "@server/station/domain/models/station.ts";
import { StationAlreadyExists } from "@server/station/domain/exceptions/station-already-exists.ts";
import type { RegisterStation } from "@server/station/application/commands/register-station.ts";

export class RegisterStationHandler {
  constructor(
    private readonly stations: Stations,
    private readonly dispatcher: Dispatcher,
  ) {}

  /**
   * Returns the freshly-minted station id so MCP inbound can echo it
   * back to the caller without a follow-up read.
   */
  async handle(command: RegisterStation): Promise<{ stationId: string }> {
    const op = command.toOperation();
    if (await this.stations.byName(op.name)) throw new StationAlreadyExists();
    const station = Station.register(op.name, op.description, op.creation);
    await this.stations.add(station);
    await this.dispatcher.dispatch(station.events.pull());
    return { stationId: station.id.value };
  }
}
