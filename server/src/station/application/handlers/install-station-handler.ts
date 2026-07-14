import type { ExecutionId } from "@server/shared/executions/domain/models/execution-id.ts";
import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";
import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import type { Task } from "@server/shared/executions/domain/models/task.ts";
import { Succeeded } from "@jsonrpc-contracts-ts/executions.gen.ts";
import { Log } from "@jsonrpc-contracts-ts/executions.gen.ts";
import type { SecretResolver } from "@server/shared/secrets/domain/ports/outbound/secret-resolver.ts";
import type { Blueprints } from "@server/station/domain/ports/outbound/blueprints.ts";
import { BlueprintName } from "@server/station/domain/contracts/blueprint.ts";
import type { Service } from "@server/station/domain/models/service/service.ts";
import { Status as ServiceStatus } from "@server/station/domain/models/service/status.ts";
import type { Station } from "@server/station/domain/models/station.ts";
import type { Stations } from "@server/station/domain/ports/outbound/stations.ts";
import type { Installer } from "@server/station/domain/ports/outbound/installer.ts";
import type { InstallStation } from "@server/station/application/commands/install-station.ts";
import { runServiceInstall } from "@server/station/application/services/run-service.ts";
import type { ActiveInstalls } from "@server/station/application/services/active-installs.ts";
import { StationNotFound } from "@server/station/domain/exceptions/station-not-found.ts";

/**
 * Single use case for installing services in a station. The command carries
 * the operator-chosen subset (`serviceIds`); the handler:
 *
 * 1. Validates that every selected id exists in the station.
 * 2. Validates the dependency closure — any selected hosted service must
 *    have its host either selected too OR already INSTALLED.
 * 3. Topologically sorts the selected subset by host dependency.
 * 4. Returns an ExecutionId; the outer task iterates the sorted services
 *    and invokes `runServiceInstall(...)` for each, mirroring outputs.
 *
 * On any per-service failure or abort, the outer task stops there —
 * remaining services in the session don't run. Already-completed services
 * keep their INSTALLED state; the failed one is FAILED.
 */
export class InstallStationHandler {
  constructor(
    private readonly stations: Stations,
    private readonly blueprints: Blueprints,
    private readonly secretResolver: SecretResolver,
    private readonly installer: Installer,
    private readonly executions: Executions,
    private readonly dispatcher: Dispatcher,
    private readonly activeInstalls: ActiveInstalls,
  ) {}

  async handle(command: InstallStation): Promise<ExecutionId> {
    const station = await this.stations.of(command.stationDomainId()).catch(() => {
      throw new StationNotFound();
    });

    const requested = new Set(command.serviceIds);
    const selected: Service[] = command.serviceDomainIds().map((id) => station.serviceById(id));

    this.validateDependencyClosure(station, selected, requested);
    const ordered = topoSort(selected);

    // All-or-nothing claim: a second session targeting any of these
    // services is rejected up front instead of failing mid-run. The claim
    // is process-local on purpose — see ActiveInstalls for why that is the
    // correct boundary (single engine process; crash recovery preserved).
    const release = this.activeInstalls.claimAll(ordered.map((s) => s.id));

    const stations = this.stations;
    const blueprints = this.blueprints;
    const secretResolver = this.secretResolver;
    const installer = this.installer;
    const dispatcher = this.dispatcher;

    // Identical shape to `ApplyNodesHandler`: loop the ordered items,
    // delegate each to a worker that owns its aggregate's lifecycle and
    // throws on failure; the runtime owns the terminal (return →
    // Succeeded, throw → Failed, aborted signal → Cancelled).
    const orchestrate: Task = {
      run: async (execution, emitter) => {
        try {
          const completed: string[] = [];
          for (const service of ordered) {
            if (execution.signal.aborted) return;
            emitter.emit(
              new Log(`▶ installing service '${service.name.value}' (${service.blueprint.value})`),
            );
            const blueprint = await blueprints.of(new BlueprintName(service.blueprint.value));
            await runServiceInstall({
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
            emitter.emit(new Log(`✓ ${service.name.value} installed`));
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
      // start() failing means the task never ran (and never will) — the
      // claim must not leak.
      release();
      throw error;
    }
  }

  /**
   * Throws if any selected hosted service has a host that is neither in the
   * selection nor already INSTALLED. The UI should auto-check missing hosts;
   * this guard catches programmatic callers and stale UI state.
   */
  private validateDependencyClosure(
    station: Station,
    selected: readonly Service[],
    requestedIds: ReadonlySet<string>,
  ): void {
    for (const service of selected) {
      if (!service.host) continue;
      const hostId = service.host.service.value;
      if (requestedIds.has(hostId)) continue;
      const host = station.services.find((s) => s.id.value === hostId);
      if (!host) {
        throw new Error(
          `service '${service.name.value}' references host '${hostId}' which is not in this station.`,
        );
      }
      if (host.status !== ServiceStatus.INSTALLED) {
        throw new Error(
          `service '${service.name.value}' is hosted on '${host.name.value}' which is not INSTALLED yet — include it in the install session.`,
        );
      }
    }
  }
}

/**
 * Topological sort by host dependency among the selected services. Hosted
 * services depend on the standalone service they pin via `host.serviceId`.
 * Hosts not in the selection are treated as already-satisfied (verified to
 * be INSTALLED earlier).
 */
export function topoSort(services: readonly Service[]): Service[] {
  const byId = new Map(services.map((s) => [s.id.value, s]));
  const result: Service[] = [];
  const remaining = new Set(services.map((s) => s.id.value));
  while (remaining.size > 0) {
    const ready: Service[] = [];
    for (const id of remaining) {
      const service = byId.get(id)!;
      if (!service.host) {
        ready.push(service);
        continue;
      }
      const depId = service.host.service.value;
      if (!byId.has(depId) || !remaining.has(depId)) {
        ready.push(service);
      }
    }
    if (ready.length === 0) {
      throw new Error("station orchestration: circular dependency between services.");
    }
    for (const service of ready) {
      result.push(service);
      remaining.delete(service.id.value);
    }
  }
  return result;
}
