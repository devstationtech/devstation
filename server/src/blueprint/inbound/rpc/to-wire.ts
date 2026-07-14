import type { BlueprintRecord as LegacyBlueprintRecord } from "@server/blueprint/application/queries/records/blueprint-record.ts";
import type { BlueprintRecord } from "@jsonrpc-contracts-ts/blueprint.gen.ts";

/**
 * Maps the legacy application `BlueprintRecord` to the wire contract.
 *
 * The only divergence is the declared-input default value: the domain
 * record calls it `default` (a TS reserved word, which the codegen
 * cannot emit as a class constructor parameter), so the wire contract
 * names it `value`. This rename is intentionally localized here at the
 * inbound boundary — `toRecord`/the legacy registry keep `default`.
 */
export function toWire(record: LegacyBlueprintRecord): BlueprintRecord {
  return {
    ...record,
    inputs: record.inputs.map((input) => {
      const { default: defaultValue, ...rest } = input;
      return defaultValue === undefined ? rest : { ...rest, value: defaultValue };
    }),
  };
}
