import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Role } from "@server/blueprint/domain/models/role.ts";
import type { RawRole } from "@server/blueprint/parser/raw/role.ts";
import type { RawStep } from "@server/blueprint/parser/raw/step.ts";
import { step } from "@server/blueprint/parser/parse/step.ts";
import { instances } from "@server/blueprint/parser/parse/instances.ts";
import { string } from "@server/blueprint/parser/parse/primitives/string.ts";

export async function role(
  { raw, fs, where }: { raw: RawRole; fs: FileSystem; where: string },
): Promise<Role> {
  if (!Array.isArray(raw.install) || raw.install.length === 0) {
    throw new Error(`${where}: role must have at least one step`);
  }
  const installSteps = await Promise.all(
    raw.install.map((rawStep, index) =>
      step({ raw: rawStep as RawStep, fs, where: `${where}.install[${index}]` })
    ),
  );
  const uninstallSteps = Array.isArray(raw.uninstall)
    ? await Promise.all(
      raw.uninstall.map((rawStep, index) =>
        step({ raw: rawStep as RawStep, fs, where: `${where}.uninstall[${index}]` })
      ),
    )
    : [];
  return new Role(
    string({ value: raw.name, where: `${where}.name` }),
    instances({ raw: raw.instances, where }),
    installSteps,
    uninstallSteps,
  );
}
