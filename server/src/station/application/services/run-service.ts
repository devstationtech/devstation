import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import type { Execution } from "@server/shared/executions/domain/models/execution.ts";
import type { Emitter } from "@server/shared/executions/domain/ports/outbound/emitter.ts";
import type { SecretResolver } from "@server/shared/secrets/domain/ports/outbound/secret-resolver.ts";
import type { Blueprint } from "@server/station/domain/contracts/blueprint.ts";
import type { Station } from "@server/station/domain/models/station.ts";
import type { Service } from "@server/station/domain/models/service/service.ts";
import type { Instance } from "@server/station/domain/models/service/instance.ts";
import type { Stations } from "@server/station/domain/ports/outbound/stations.ts";
import type {
  Installer,
  ResolvedInstance,
} from "@server/station/domain/ports/outbound/installer.ts";

/**
 * Runs one service's install lifecycle within the outer execution:
 * transition the Station to start, drive the installer Task (streaming its
 * logs/steps straight through the shared emitter), then apply the
 * terminal Station mutation with persist + event flush.
 *
 * Mirrors `ApplyNodesHandler` exactly: success → `installService` and
 * return; a thrown error → `failService` (or `abortService` when the
 * execution was cancelled) + persist, then **re-throw** so the outer
 * orchestration Task fails and the runtime owns the terminal. The only
 * difference from the provisioning Task is that this one produces a domain result —
 * the `Installation[]` returned by `installer.install(...).run(...)`.
 */
export async function runServiceInstall(
  args: {
    station: Station;
    service: Service;
    blueprint: Blueprint;
    stations: Stations;
    secretResolver: SecretResolver;
    installer: Installer;
    dispatcher: Dispatcher;
    execution: Execution;
    emitter: Emitter;
  },
): Promise<void> {
  const {
    station,
    service,
    blueprint,
    stations,
    secretResolver,
    installer,
    dispatcher,
    execution,
    emitter,
  } = args;

  const secrets = await resolveSecrets(secretResolver, service);
  const instances = service.isHosted
    ? await resolveHostedInstances(station, service, secretResolver)
    : await resolveStandaloneInstances(service.instances, secretResolver);

  // Every Station mutation goes through `stations.update` — the aggregate
  // is reloaded fresh inside the write lock, so this minutes-long install
  // can't overwrite concurrent changes that landed since our snapshot.
  // The snapshot above is used only for resolution data (instances,
  // inputs, secrets refs), mirroring how the provisioning handlers treat
  // their cluster snapshot.
  const transition = async (change: (s: Station) => void): Promise<void> => {
    const updated = await stations.update(station.id, change);
    await dispatcher.dispatch(updated.events.pull());
  };

  await transition((s) => s.startServiceInstall(service.id));

  try {
    const installations = await installer
      .install({ blueprint, inputs: service.inputs.toRecord(), secrets, instances })
      .run(execution, emitter);

    await transition((s) => s.installService(service.id, installations));
  } catch (err) {
    if (execution.signal.aborted) {
      await transition((s) => s.abortService(service.id));
      throw err;
    }
    const reason = err instanceof Error ? err.message : String(err);
    await transition((s) => s.failService(service.id, reason));
    throw err instanceof Error ? err : new Error(reason);
  }
}

/**
 * Runs one service's teardown lifecycle within the outer execution — the
 * mirror of `runServiceInstall`. Transitions the Station to UNINSTALLING, drives
 * the installer's uninstall Task (streaming logs through the emitter), then on
 * success applies `uninstallService` (clears the service's installations and emits
 * `ServiceUninstalled` so vault/cluster listeners clean up). A thrown error →
 * `failServiceUninstall` (or `abortServiceUninstall` when cancelled) + re-throw.
 */
export async function runServiceUninstall(
  args: {
    station: Station;
    service: Service;
    blueprint: Blueprint;
    stations: Stations;
    secretResolver: SecretResolver;
    installer: Installer;
    dispatcher: Dispatcher;
    execution: Execution;
    emitter: Emitter;
  },
): Promise<void> {
  const {
    station,
    service,
    blueprint,
    stations,
    secretResolver,
    installer,
    dispatcher,
    execution,
    emitter,
  } = args;

  // Teardown steps may need the same credentials the install used (to stop a
  // remote service, drop a database, etc.) — resolve them before tearing down.
  const secrets = await resolveSecrets(secretResolver, service);
  const instances = service.isHosted
    ? await resolveHostedInstances(station, service, secretResolver)
    : await resolveStandaloneInstances(service.instances, secretResolver);

  const transition = async (change: (s: Station) => void): Promise<void> => {
    const updated = await stations.update(station.id, change);
    await dispatcher.dispatch(updated.events.pull());
  };

  await transition((s) => s.startServiceUninstall(service.id));

  try {
    await installer
      .uninstall({ blueprint, inputs: service.inputs.toRecord(), secrets, instances })
      .run(execution, emitter);

    await transition((s) => s.uninstallService(service.id));
  } catch (err) {
    if (execution.signal.aborted) {
      await transition((s) => s.abortServiceUninstall(service.id));
      throw err;
    }
    const reason = err instanceof Error ? err.message : String(err);
    await transition((s) => s.failServiceUninstall(service.id, reason));
    throw err instanceof Error ? err : new Error(reason);
  }
}

async function resolveSecrets(
  resolver: SecretResolver,
  service: Service,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of service.secrets.names()) {
    const ref = service.secrets.get(name);
    const value = await resolver.resolve(service.vault, ref);
    if (value === null) missing.push(name);
    else out[name] = value;
  }
  if (missing.length > 0) {
    throw new Error(`service '${service.name.value}' secrets unresolved: ${missing.join(", ")}.`);
  }
  return out;
}

/**
 * Effective instances of a service, walking the host chain down to the
 * standalone root. A hosted service carries no instances of its own (domain
 * invariant), so its effective instances are its host service's effective
 * instances matching the role it binds to — recursively, since a host can
 * itself be hosted (portainer on docker; nginx-proxy-manager on portainer).
 * A cycle in persisted data fails loudly instead of recursing forever.
 */
export function hostChainInstances(
  service: Service,
  serviceById: (id: Service["id"]) => Service,
  visited: Set<string> = new Set(),
): readonly Instance[] {
  if (!service.host) return service.instances;
  if (visited.has(service.id.value)) {
    throw new Error(`host chain of service '${service.name.value}' has a cycle.`);
  }
  visited.add(service.id.value);
  const hostService = serviceById(service.host.service);
  return hostChainInstances(hostService, serviceById, visited)
    .filter((i) => i.role.name === service.host!.role);
}

function resolveHostedInstances(
  station: Station,
  service: Service,
  resolver: SecretResolver,
): Promise<ResolvedInstance[]> {
  if (!service.host) throw new Error("hosted service is missing host reference.");
  const matching = hostChainInstances(service, (id) => station.serviceById(id));
  if (matching.length === 0) {
    const hostService = station.serviceById(service.host.service);
    throw new Error(
      `host service '${hostService.name.value}' has no instances of role '${service.host.role}'.`,
    );
  }
  return resolveStandaloneInstances(matching, resolver);
}

async function resolveStandaloneInstances(
  instances: readonly Instance[],
  resolver: SecretResolver,
): Promise<ResolvedInstance[]> {
  const resolved: ResolvedInstance[] = [];
  for (const instance of instances) {
    // Only the username is resolved from the vault. The SSH password
    // stored against this instance is left in the vault — automation
    // connects via the shared CLI key (~/.ssh/devstation_ed25519),
    // while the password is for the user's own manual access (terminal,
    // scp, etc.).
    const vault = instance.credential.vault;
    const user = await resolver.resolve(vault, instance.credential.username);
    if (!user) {
      throw new Error(
        `instance '${instance.host}' (${instance.role.name}) credentials unresolved: username.`,
      );
    }
    resolved.push({ role: instance.role, host: instance.host, user });
  }
  return resolved;
}
