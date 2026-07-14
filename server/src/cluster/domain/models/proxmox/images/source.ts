import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import type { Url } from "@server/cluster/domain/models/proxmox/images/url.ts";

export class Source implements ValueObject {
  constructor(readonly url: Url) {}
}
