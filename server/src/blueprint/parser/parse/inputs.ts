import type { Input } from "@server/blueprint/domain/models/input/input.ts";
import type { RawInput } from "@server/blueprint/parser/raw/input.ts";
import { input } from "@server/blueprint/parser/parse/input.ts";

export function inputs({ raw, where }: { raw: unknown; where: string }): Input[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new Error(`${where}.inputs: must be an array`);
  }
  return raw.map((entry, index) =>
    input({ raw: entry as RawInput, where: `${where}.inputs[${index}]` })
  );
}
