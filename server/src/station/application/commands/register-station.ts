import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Name } from "@server/station/domain/models/name.ts";
import { Description } from "@server/station/domain/models/description.ts";

export class RegisterStation {
  constructor(
    readonly name: string,
    readonly description: string,
    readonly user: string,
    readonly hostname: string,
  ) {}

  toOperation(): { name: Name; description: Description; creation: Creation } {
    return {
      name: new Name(this.name),
      description: new Description(this.description),
      creation: Creation.now(new User(this.user), new Hostname(this.hostname)),
    };
  }
}
