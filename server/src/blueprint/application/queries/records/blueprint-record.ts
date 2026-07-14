export type InputDeclRecord = {
  name: string;
  label: string;
  type: string;
  required: boolean;
  default?: string | number | boolean;
  help?: string;
};

export type StepRecord = {
  name: string;
  description: string;
  hasVerify: boolean;
  hasRollback: boolean;
};

export type RoleRecord = {
  name: string;
  instances: "one" | "many" | "zeroOrMore";
  steps: StepRecord[];
};

export type HostRecord = {
  blueprint: string;
  role: string;
};

export type BlueprintRecord = {
  /** Equal to `name`; preserved for compatibility with consumers using `id`. */
  id: string;
  name: string;
  /** Where it came from: bundled catalog ("official") or the user's local overlay ("local"). */
  origin: "official" | "local";
  description: string;
  version: string;
  compatibility: { os: string[] };
  placement: "exclusive" | "shared";
  inputs: InputDeclRecord[];
  /** Standalone: roles populated, host null. Hosted: empty roles, host set, steps populated. */
  roles: RoleRecord[];
  host: HostRecord | null;
  steps: StepRecord[];
};
