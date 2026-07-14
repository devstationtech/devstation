import type { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";
import { Compatibility } from "@server/blueprint/domain/models/compatibility.ts";

export function compatibility(
  { raw, where }: { raw: unknown; where: string },
): Compatibility {
  if (!raw || typeof raw !== "object") {
    throw new Error(`${where}.compatibility: required mapping with 'os'`);
  }
  const os = (raw as { os?: unknown }).os;
  if (!Array.isArray(os) || os.length === 0) {
    throw new Error(`${where}.compatibility.os: required non-empty array`);
  }
  const supported = os.map((value, index) => {
    if (typeof value !== "string" || !value) {
      throw new Error(`${where}.compatibility.os[${index}]: required non-empty string`);
    }
    return value as OperatingSystem;
  });
  return new Compatibility(supported);
}
