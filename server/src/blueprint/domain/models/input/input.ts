import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import type { Name } from "@server/blueprint/domain/models/input/name.ts";
import type { Label } from "@server/blueprint/domain/models/input/label.ts";
import type { Help } from "@server/blueprint/domain/models/input/help.ts";
import type { Type } from "@server/blueprint/domain/models/input/type.ts";
import type { Default } from "@server/blueprint/domain/models/input/default.ts";

/**
 * Validated input declaration on a stack. Blueprint authors describe inputs
 * structurally via the DSL `Size`; the factory wraps each one into
 * this VO before the runtime sees it.
 */
export class Input implements ValueObject {
  constructor(
    readonly name: Name,
    readonly label: Label,
    readonly type: Type,
    readonly required: boolean,
    readonly defaultValue: Default | null,
    readonly help: Help | null,
  ) {}
}
