// AUTO-GENERATED from @jsonrpc-schemas/blueprint.openrpc.json
// Do not edit by hand — run `deno task contracts:codegen`.

/** Result of validating a candidate blueprint with the real parser. */
export class BlueprintValidationRecord {
  constructor(
    readonly valid: boolean,
    /** The blueprint's declared name when valid; null otherwise. */
    readonly name: string | null,
    /** The parser/validation error message when invalid; null otherwise. */
    readonly error: string | null,
    /** Origin of a catalog blueprint that already uses this name, or null if the name is free. */
    readonly existing: "official" | "local" | null,
  ) {}
}

/** Declared service input. `value` is the input's default value (absent when none). Wire field is `value` (the legacy domain field `default` is a TS reserved word and is mapped at the endpoint boundary). */
export class BlueprintInputDeclRecord {
  constructor(
    readonly name: string,
    readonly label: string,
    readonly type: string,
    readonly required: boolean,
    readonly value?: string | number | boolean,
    readonly help?: string,
  ) {}
}

export class BlueprintStepRecord {
  constructor(
    readonly name: string,
    readonly description: string,
    readonly hasVerify: boolean,
    readonly hasRollback: boolean,
  ) {}
}

export class BlueprintRoleRecord {
  constructor(
    readonly name: string,
    readonly instances: "one" | "many" | "zeroOrMore",
    readonly steps: ReadonlyArray<BlueprintStepRecord>,
  ) {}
}

/** Host topology for hosted blueprints. Null for standalone blueprints. */
export type BlueprintHostRecord = { readonly blueprint: string; readonly role: string } | null;

export class BlueprintCompatibilityRecord {
  constructor(
    readonly os: ReadonlyArray<string>,
  ) {}
}

/** Blueprint catalog entry. Standalone: roles populated, host null. Hosted: empty roles, host set, steps populated. */
export class BlueprintRecord {
  constructor(
    readonly id: string,
    readonly name: string,
    /** Where the blueprint came from: the bundled catalog (official) or the user's local overlay (local). */
    readonly origin: "official" | "local",
    readonly description: string,
    readonly version: string,
    readonly compatibility: BlueprintCompatibilityRecord,
    readonly placement: "exclusive" | "shared",
    readonly inputs: ReadonlyArray<BlueprintInputDeclRecord>,
    readonly roles: ReadonlyArray<BlueprintRoleRecord>,
    readonly host: BlueprintHostRecord,
    readonly steps: ReadonlyArray<BlueprintStepRecord>,
  ) {}
}

/** Request payload for `blueprint.list`. */
export interface BlueprintListRequest {
  readonly sessionId: string;
}

/** Response payload of `blueprint.list`. */
export type BlueprintListResponse = ReadonlyArray<BlueprintRecord>;

/** Request payload for `blueprint.byId`. */
export interface BlueprintByIdRequest {
  readonly sessionId: string;
  readonly id: string;
}

/** Response payload of `blueprint.byId`. */
export type BlueprintByIdResponse = BlueprintRecord;

/** Request payload for `blueprint.validate`. */
export interface BlueprintValidateRequest {
  readonly path: string;
}

/** Response payload of `blueprint.validate`. */
export type BlueprintValidateResponse = BlueprintValidationRecord;
