import { Integer } from "@server/shared/building-blocks/domain/models/value-objects/integer.ts";

export class Version extends Integer {
  next(): Version {
    return new Version(this.value + 1);
  }
}
