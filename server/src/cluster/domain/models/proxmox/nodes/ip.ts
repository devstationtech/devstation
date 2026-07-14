import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export class Ip implements ValueObject {
  constructor(readonly value: string) {
    if (!value) throw new Error("ip is required.");
    const match = value.match(IPV4_PATTERN);
    if (!match) throw new Error("ip must be a valid IPv4 address.");
    const octets = [match[1], match[2], match[3], match[4]].map(Number);
    if (octets.some((o) => o < 0 || o > 255)) {
      throw new Error("ip octets must be between 0 and 255.");
    }
  }
}
