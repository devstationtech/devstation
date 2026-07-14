import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Blueprint } from "@server/blueprint/domain/models/blueprint.ts";
import { Description } from "@server/blueprint/domain/models/description.ts";
import type { Host } from "@server/blueprint/domain/models/host.ts";
import { Name } from "@server/blueprint/domain/models/name.ts";
import type { Role } from "@server/blueprint/domain/models/role.ts";
import type { Step } from "@server/blueprint/domain/models/step/step.ts";
import { SemVer } from "@server/blueprint/domain/models/sem-ver.ts";

import type { RawBlueprint } from "@server/blueprint/parser/raw/blueprint.ts";
import type { RawRole } from "@server/blueprint/parser/raw/role.ts";
import type { RawStep } from "@server/blueprint/parser/raw/step.ts";

import { compatibility } from "@server/blueprint/parser/parse/compatibility.ts";
import { host as parseHost } from "@server/blueprint/parser/parse/host.ts";
import { inputs } from "@server/blueprint/parser/parse/inputs.ts";
import { placement } from "@server/blueprint/parser/parse/placement.ts";
import { role } from "@server/blueprint/parser/parse/role.ts";
import { step } from "@server/blueprint/parser/parse/step.ts";
import { string } from "@server/blueprint/parser/parse/primitives/string.ts";

/**
 * Validates and parses a YAML mapping into a domain Blueprint.
 *
 * Handles the two shapes:
 * - Standalone: declares `roles[]`. Steps live inside roles.
 * - Hosted: declares `host:` plus top-level `install[]`. No roles of its own.
 *
 * Throws on the first failure with a contextual `where` path so authors can
 * locate the offending YAML key directly.
 */
export async function blueprint(
  { raw, fs }: { raw: RawBlueprint; fs: FileSystem },
): Promise<Blueprint> {
  if (!raw || typeof raw !== "object") {
    throw new Error(`blueprint.yaml: expected a top-level mapping`);
  }

  const name = string({ value: raw.name, where: "name" });
  const hasRoles = Array.isArray(raw.roles) && raw.roles.length > 0;
  const isHosted = raw.host !== undefined && raw.host !== null;

  let roles: Role[] = [];
  let resolvedHost: Host | null = null;
  let topInstallSteps: Step[] = [];
  let topUninstallSteps: Step[] = [];

  if (isHosted) {
    resolvedHost = parseHost({ raw: raw.host, where: `${name}.host` });
    if (!Array.isArray(raw.install) || raw.install.length === 0) {
      throw new Error(`blueprint '${name}': hosted blueprint must declare top-level 'install'`);
    }
    topInstallSteps = await Promise.all(
      raw.install.map((rawStep, index) =>
        step({ raw: rawStep as RawStep, fs, where: `${name}.install[${index}]` })
      ),
    );
    if (Array.isArray(raw.uninstall)) {
      topUninstallSteps = await Promise.all(
        raw.uninstall.map((rawStep, index) =>
          step({ raw: rawStep as RawStep, fs, where: `${name}.uninstall[${index}]` })
        ),
      );
    }
  } else if (hasRoles) {
    roles = await Promise.all(
      (raw.roles as RawRole[]).map((rawRole, index) =>
        role({ raw: rawRole, fs, where: `${name}.roles[${index}]` })
      ),
    );
  } else {
    throw new Error(
      `blueprint '${name}': must declare either 'roles' (standalone) or 'host' (hosted)`,
    );
  }

  return new Blueprint(
    new Name(name),
    new Description(string({ value: raw.description, where: "description" })),
    new SemVer(string({ value: raw.version, where: "version" })),
    compatibility({ raw: raw.compatibility, where: name }),
    placement({ raw: raw.placement, where: name }),
    inputs({ raw: raw.inputs, where: name }),
    roles,
    resolvedHost,
    topInstallSteps,
    topUninstallSteps,
  );
}
