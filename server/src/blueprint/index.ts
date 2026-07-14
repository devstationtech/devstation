// Barrel for the blueprint module. Internal consumers (service, query,
// dependencies) import via this entry point.
//
// Blueprint authors write `blueprints/<name>/blueprint.yaml`. The catalog
// (`Blueprints`) parses YAML into the domain Blueprint at load time.

// Domain models — VOs of the blueprint itself.
export { Blueprint } from "@server/blueprint/domain/models/blueprint.ts";
export { Role } from "@server/blueprint/domain/models/role.ts";
export { Name } from "@server/blueprint/domain/models/name.ts";
export { Description } from "@server/blueprint/domain/models/description.ts";
export { SemVer } from "@server/blueprint/domain/models/sem-ver.ts";
export { Compatibility } from "@server/blueprint/domain/models/compatibility.ts";

export { Input } from "@server/blueprint/domain/models/input/input.ts";
export { Name as InputName } from "@server/blueprint/domain/models/input/name.ts";
export { Label as InputLabel } from "@server/blueprint/domain/models/input/label.ts";
export { Help as InputHelp } from "@server/blueprint/domain/models/input/help.ts";
export { Type as InputType } from "@server/blueprint/domain/models/input/type.ts";
export type { Default as InputDefault } from "@server/blueprint/domain/models/input/default.ts";

export { Step } from "@server/blueprint/domain/models/step/step.ts";
export { Id as StepId } from "@server/blueprint/domain/models/step/id.ts";
export { Description as StepDescription } from "@server/blueprint/domain/models/step/description.ts";

export { Host } from "@server/blueprint/domain/models/host.ts";
export type { Instances } from "@server/blueprint/domain/models/instances.ts";
export type { Placement } from "@server/blueprint/domain/models/placement.ts";

// Step runtime types — consumed by the installer adapter that interprets
// each Step descriptor against an SSH context.
export { Result as VerifyResult } from "@server/blueprint/contracts/step/verify/result.ts";

export type { Event as StepEvent } from "@server/blueprint/contracts/step/event/event.ts";
export type { Log as StepLogEvent } from "@server/blueprint/contracts/step/event/log.ts";
export type { Progress as StepProgressEvent } from "@server/blueprint/contracts/step/event/progress.ts";
export type { Secret as StepSecretEvent } from "@server/blueprint/contracts/step/event/secret.ts";
export type { Fact as StepFactEvent } from "@server/blueprint/contracts/step/event/fact.ts";

export type { Context as StepContext } from "@server/blueprint/contracts/step/context/context.ts";
export type { Inputs } from "@server/blueprint/contracts/step/context/inputs.ts";
export type { Secrets } from "@server/blueprint/contracts/step/context/secrets.ts";
export type { Ssh } from "@server/blueprint/contracts/step/context/ssh.ts";
export type { ExecResult } from "@server/blueprint/contracts/step/context/exec-result.ts";
export type { Peer } from "@server/blueprint/contracts/step/context/peer.ts";
export type { RoleHandle } from "@server/blueprint/contracts/step/context/role-handle.ts";

export * from "@server/blueprint/exceptions/blueprint-not-found.ts";
export * from "@server/blueprint/exceptions/blueprint-os-incompatible.ts";

export { Blueprints } from "@server/blueprint/blueprints.ts";
