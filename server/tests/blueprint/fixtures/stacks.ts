import {
  Blueprint,
  Compatibility,
  Description,
  Host,
  type Instances,
  Name,
  type Placement,
  Role,
  SemVer,
  Step,
  StepDescription,
  StepId,
} from "@server/blueprint/index.ts";
import { Publish } from "@server/blueprint/domain/models/step/publish.ts";
import { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";

export function aStep(name = "install", shell = `echo ${name}`): Step {
  return new Step(
    new StepId(name),
    new StepDescription(name),
    shell,
    {},
    null,
    new Publish({}, {}),
    null,
  );
}

export function aRole(
  name = "main",
  steps: Step[] = [aStep()],
  instances: Instances = "one",
): Role {
  return new Role(name, instances, steps);
}

export function aStack(
  name = "test-blueprint",
  roles: Role[] = [aRole()],
  description = "test blueprint",
  supportedOs: OperatingSystem[] = [OperatingSystem.UBUNTU_22_04],
  placement: Placement = "exclusive",
): Blueprint {
  return new Blueprint(
    new Name(name),
    new Description(description),
    new SemVer("1.0.0"),
    new Compatibility(supportedOs),
    placement,
    [],
    roles,
    null,
    [],
  );
}

export function aHostedStack(
  name = "test-hosted",
  hostBlueprint = "test-host",
  hostRole = "main",
  steps: Step[] = [aStep()],
  description = "test hosted blueprint",
  supportedOs: OperatingSystem[] = [OperatingSystem.UBUNTU_22_04],
  placement: Placement = "exclusive",
): Blueprint {
  return new Blueprint(
    new Name(name),
    new Description(description),
    new SemVer("1.0.0"),
    new Compatibility(supportedOs),
    placement,
    [],
    [],
    new Host(new Name(hostBlueprint), hostRole),
    steps,
  );
}
