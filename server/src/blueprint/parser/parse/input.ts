import { Input } from "@server/blueprint/domain/models/input/input.ts";
import { Help as InputHelp } from "@server/blueprint/domain/models/input/help.ts";
import { Label as InputLabel } from "@server/blueprint/domain/models/input/label.ts";
import { Name as InputName } from "@server/blueprint/domain/models/input/name.ts";
import { Type as InputType } from "@server/blueprint/domain/models/input/type.ts";
import type { RawInput } from "@server/blueprint/parser/raw/input.ts";
import { string } from "@server/blueprint/parser/parse/primitives/string.ts";

const TYPES_BY_KEYWORD: Record<string, InputType> = {
  string: InputType.STRING,
  number: InputType.NUMBER,
  boolean: InputType.BOOLEAN,
  secret: InputType.SECRET,
};

export function input({ raw, where }: { raw: RawInput; where: string }): Input {
  const name = string({ value: raw.name, where: `${where}.name` });
  const label = string({ value: raw.label, where: `${where}.label` });
  const typeKeyword = string({ value: raw.type, where: `${where}.type` });
  const type = TYPES_BY_KEYWORD[typeKeyword];
  if (!type) {
    throw new Error(
      `${where}.type: unknown '${typeKeyword}' (expected: ${
        Object.keys(TYPES_BY_KEYWORD).join(", ")
      })`,
    );
  }
  const required = raw.required === undefined ? false : Boolean(raw.required);
  const help = raw.help !== undefined
    ? new InputHelp(string({ value: raw.help, where: `${where}.help` }))
    : null;
  const defaultValue = raw.default === undefined
    ? null
    : (raw.default as string | number | boolean);

  return new Input(new InputName(name), new InputLabel(label), type, required, defaultValue, help);
}
