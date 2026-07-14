import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import type { Url } from "@server/images/domain/models/url.ts";

export class Source implements ValueObject {
  constructor(readonly url: Url) {}
}
