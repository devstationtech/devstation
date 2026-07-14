import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import type { Blueprints } from "@server/station/domain/ports/outbound/blueprints.ts";
import { BlueprintName } from "@server/station/domain/contracts/blueprint.ts";
import type { Stations } from "@server/station/domain/ports/outbound/stations.ts";
import type { RegisterService } from "@server/station/application/commands/register-service.ts";
import { ServiceAlreadyExists } from "@server/station/domain/exceptions/service-already-exists.ts";
import { UnknownRole } from "@server/station/domain/exceptions/unknown-role.ts";
import { StationNotFound } from "@server/station/domain/exceptions/station-not-found.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Id } from "@server/station/domain/models/service/id.ts";
import { Name } from "@server/station/domain/models/service/name.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import { Secrets } from "@server/station/domain/models/service/secrets.ts";
import { Inputs } from "@server/station/domain/models/service/inputs.ts";
import { Instance } from "@server/station/domain/models/service/instance.ts";
import { Credential } from "@server/shared/building-blocks/domain/models/value-objects/credential.ts";
import { Role } from "@server/station/domain/models/service/role.ts";
import { Host } from "@server/station/domain/models/service/host.ts";

export class RegisterServiceHandler {
  constructor(
    private readonly stations: Stations,
    private readonly blueprints: Blueprints,
    private readonly dispatcher: Dispatcher,
  ) {}

  async handle(command: RegisterService): Promise<void> {
    const station = await this.stations.of(command.stationDomainId()).catch(() => {
      throw new StationNotFound();
    });

    if (station.serviceByName(command.name)) {
      throw new ServiceAlreadyExists();
    }

    const blueprint = await this.blueprints.of(new BlueprintName(command.blueprint));

    if (blueprint.isHosted) {
      if (!command.host) {
        throw new Error(
          `blueprint '${blueprint.name.value}' is hosted — host reference is required.`,
        );
      }
      const expectedRole = blueprint.host!.role;
      if (command.host.role !== expectedRole) {
        throw new Error(
          `blueprint '${blueprint.name.value}' runs on role '${expectedRole}', got '${command.host.role}'.`,
        );
      }
      const hostService = station.services.find(
        (s) => s.id.value === command.host!.serviceId,
      );
      if (!hostService) {
        throw new Error(
          `host service '${command.host.serviceId}' not found in station.`,
        );
      }
      const expectedBlueprint = blueprint.host!.blueprint.value;
      if (hostService.blueprint.value !== expectedBlueprint) {
        throw new Error(
          `host service blueprint mismatch: expected '${expectedBlueprint}', got '${hostService.blueprint.value}'.`,
        );
      }
    } else {
      // Only roles with cardinality 'one' or 'many' are required.
      // 'zeroOrMore' roles can be omitted entirely (e.g. k3s.agent on a
      // single-node cluster). At least one instance overall is still
      // required so we don't register an empty service.
      const requiredRoles = blueprint.roles
        .filter((r) => r.instances === "one" || r.instances === "many")
        .map((r) => r.name);
      if (requiredRoles.length > 0 && (!command.instances || command.instances.length === 0)) {
        throw new Error(
          `blueprint '${blueprint.name.value}' requires instances for roles: ${
            requiredRoles.join(", ")
          }.`,
        );
      }
      const declaredRoles = blueprint.roles.map((r) => r.name);
      this.checkRoles(requiredRoles, declaredRoles, command.instances ?? [], blueprint.name.value);
    }

    const resolvedHost = command.host
      ? new Host(new Id(command.host.serviceId), command.host.role)
      : null;
    const resolvedInstances = command.instances
      ? command.instances.map((i) =>
        new Instance(
          new Role(i.role),
          i.host,
          new Credential(
            new Vault(i.credentialVaultId),
            new Secret(i.usernameSecretId),
            new Secret(i.passwordSecretId),
          ),
        )
      )
      : [];
    station.addService(
      new Id(),
      new Name(command.name),
      new BlueprintName(command.blueprint),
      new Vault(command.vaultId),
      new Inputs(command.inputs),
      new Secrets(
        Object.fromEntries(
          Object.entries(command.secrets).map(([k, v]) => [k, new Secret(v)]),
        ),
      ),
      resolvedInstances,
      resolvedHost,
      Creation.now(new User(command.user), new Hostname(command.hostname)),
    );
    await this.stations.save(station);
    await this.dispatcher.dispatch(station.events.pull());
  }

  private checkRoles(
    required: string[],
    declared: string[],
    instances: readonly { role: string }[],
    blueprintName: string,
  ): void {
    // Instances may target ANY declared role (a `zeroOrMore` role is optional,
    // not forbidden); only `one`/`many` roles are demanded below.
    const valid = new Set(declared);
    const seen = new Set<string>();
    for (const i of instances) {
      if (!valid.has(i.role)) throw new UnknownRole(i.role, declared);
      seen.add(i.role);
    }
    const missing = required.filter((d) => !seen.has(d));
    if (missing.length > 0) {
      // The bare "roles without instances: agent" message was opaque.
      // The error now names the blueprint, lists exactly what's missing,
      // and tells the caller how to fix it.
      throw new Error(
        `roles without instances: ${missing.join(", ")} — blueprint '${blueprintName}' requires ` +
          `≥1 instance for each role (declared as 'one' or 'many'). Provide one in ` +
          `instances:[{role:'${missing[0]}', host:..., credentialVaultId:..., ` +
          `usernameSecretId:..., passwordSecretId:...}], or use a blueprint that ` +
          `marks the role as 'zeroOrMore' if it's truly optional.`,
      );
    }
  }
}
