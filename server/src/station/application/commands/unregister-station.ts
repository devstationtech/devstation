import { Id } from "@server/station/domain/models/id.ts";

export class UnregisterStation {
  constructor(readonly stationId: string) {}

  toOperation(): { id: Id } {
    return { id: new Id(this.stationId) };
  }
}
