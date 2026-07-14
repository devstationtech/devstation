import type { Blueprint, Step } from "@server/blueprint/index.ts";
import type { BlueprintOrigin } from "@server/blueprint/blueprints.ts";
import type {
  BlueprintRecord,
  StepRecord,
} from "@server/blueprint/application/queries/records/blueprint-record.ts";

export function toRecord(blueprint: Blueprint, origin: BlueprintOrigin): BlueprintRecord {
  return {
    id: blueprint.name.value,
    name: blueprint.name.value,
    origin,
    description: blueprint.description.value,
    version: blueprint.version.value,
    compatibility: { os: blueprint.compatibility.os.map((os) => String(os)) },
    placement: blueprint.placement,
    inputs: blueprint.inputs.map((input) => ({
      name: input.name.value,
      label: input.label.value,
      type: String(input.type),
      required: input.required,
      default: input.defaultValue ?? undefined,
      help: input.help?.value,
    })),
    roles: blueprint.roles.map((role) => ({
      name: role.name,
      instances: role.instances,
      steps: role.installSteps.map(toStepRecord),
    })),
    host: blueprint.host
      ? { blueprint: blueprint.host.blueprint.value, role: blueprint.host.role }
      : null,
    steps: blueprint.installSteps.map(toStepRecord),
  };
}

function toStepRecord(step: Step): StepRecord {
  return {
    name: step.id.value,
    description: step.description.value,
    hasVerify: step.verify !== null,
    hasRollback: step.rollback !== null,
  };
}
