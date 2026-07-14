import { Id } from "@server/station/domain/models/id.ts";
import { Name } from "@server/station/domain/models/name.ts";
import { Description } from "@server/station/domain/models/description.ts";

export class UpdateStation {
  constructor(
    readonly stationId: string,
    readonly name: string,
    readonly description: string,
  ) {}

  toOperation(): { id: Id; name: Name; description: Description } {
    return {
      id: new Id(this.stationId),
      name: new Name(this.name),
      description: new Description(this.description),
    };
  }
}
