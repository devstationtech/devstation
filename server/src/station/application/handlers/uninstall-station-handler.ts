import type { ExecutionId } from "@server/shared/executions/domain/models/execution-id.ts";
import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";
import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import type { Task } from "@server/shared/executions/domain/models/task.ts";
import { Log, Succeeded } from "@jsonrpc-contracts-ts/executions.gen.ts";
import type { SecretResolver } from "@server/shared/secrets/domain/ports/outbound/secret-resolver.ts";
import type { Blueprints } from "@server/station/domain/ports/outbound/blueprints.ts";
import { BlueprintName } from "@server/station/domain/contracts/blueprint.ts";
import type { Service } from "@server/station/domain/models/service/service.ts";
import { Status as ServiceStatus } from "@server/station/domain/models/service/status.ts";
import type { Station } from "@server/station/domain/models/station.ts";
import type { Stations } from "@server/station/domain/ports/outbound/stations.ts";
import type { Installer } from "@server/station/domain/ports/outbound/installer.ts";
import type { UninstallStation } from "@server/station/application/commands/uninstall-station.ts";
import { runServiceUninstall } from "@server/station/application/services/run-service.ts";
import { topoSort } from "@server/station/application/handlers/install-station-handler.ts";
import type { ActiveInstalls } from "@server/station/application/services/active-installs.ts";
import { StationNotFound } from "@server/station/domain/exceptions/station-not-found.ts";

/**
 * Mirror of `InstallStationHandler` for teardown. The command carries the
 * operator-chosen subset; the handler:
 *
 * 1. Validates that every selected id exists in the station.
 * 2. Validates the reverse dependency closure — a selected host service may
 *    not be uninstalled while a hosted dependent stays INSTALLED unless that
 *    dependent is in the selection too.
 * 3. Runs in **reverse** topological order (dependents before their hosts).
 *
 * Reuses `ActiveInstalls` so a service can't install and uninstall at once.
 */
export class UninstallStationHandler {
  constructor(
    private readonly stations: Stations,
    private readonly blueprints: Blueprints,
    private readonly secretResolver: SecretResolver,
    private readonly installer: Installer,
    private readonly executions: Executions,
    private readonly dispatcher: Dispatcher,
    private readonly activeInstalls: ActiveInstalls,
  ) {}

  async handle(command: UninstallStation): Promise<ExecutionId> {
    const station = await this.stations.of(command.stationDomainId()).catch(() => {
      throw new StationNotFound();
    });

    const requested = new Set(command.serviceIds);
    const selected: Service[] = command.serviceDomainIds().map((id) => station.serviceById(id));

    this.validateReverseClosure(station, requested);
    // Install order is hosts-first; teardown is the reverse.
    const ordered = topoSort(selected).reverse();

    const release = this.activeInstalls.claimAll(ordered.map((s) => s.id));

    const stations = this.stations;
    const blueprints = this.blueprints;
    const secretResolver = this.secretResolver;
    const installer = this.installer;
    const dispatcher = this.dispatcher;

    const orchestrate: Task = {
      run: async (execution, emitter) => {
        try {
          const completed: string[] = [];
          for (const service of ordered) {
            if (execution.signal.aborted) return;
            emitter.emit(
              new Log(
                `▶ uninstalling service '${service.name.value}' (${service.blueprint.value})`,
              ),
            );
            const blueprint = await blueprints.of(new BlueprintName(service.blueprint.value));
            await runServiceUninstall({
              station,
              service,
              blueprint,
              stations,
              secretResolver,
              installer,
              dispatcher,
              execution,
              emitter,
            });
            completed.push(service.id.value);
            emitter.emit(new Log(`✓ ${service.name.value} uninstalled`));
          }
          emitter.emit(new Succeeded(completed));
        } finally {
          release();
        }
      },
    };

    try {
      return this.executions.start(orchestrate).id;
    } catch (error) {
      release();
      throw error;
    }
  }

  /**
   * Throws if a selected host service still has a INSTALLED hosted dependent
   * that is not also being uninstalled — tearing the host down would orphan it.
   */
  private validateReverseClosure(
    station: Station,
    requestedIds: ReadonlySet<string>,
  ): void {
    for (const dependent of station.services) {
      if (!dependent.host) continue;
      if (dependent.status !== ServiceStatus.INSTALLED) continue;
      const hostId = dependent.host.service.value;
      if (requestedIds.has(hostId) && !requestedIds.has(dependent.id.value)) {
        const host = station.services.find((s) => s.id.value === hostId);
        throw new Error(
          `cannot uninstall '${
            host?.name.value ?? hostId
          }' while '${dependent.name.value}' is still installed on it — include it in the uninstall session.`,
        );
      }
    }
  }
}
