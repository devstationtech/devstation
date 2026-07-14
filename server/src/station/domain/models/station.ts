import { Aggregate } from "@server/shared/building-blocks/domain/models/aggregate.ts";
import type { Version } from "@server/shared/building-blocks/domain/models/value-objects/version.ts";
import type { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { Id } from "@server/station/domain/models/id.ts";
import type { Name } from "@server/station/domain/models/name.ts";
import type { Description } from "@server/station/domain/models/description.ts";
import { Status } from "@server/station/domain/models/status.ts";
import { Service } from "@server/station/domain/models/service/service.ts";
import type { Id as ServiceId } from "@server/station/domain/models/service/id.ts";
import type { Installation } from "@server/station/domain/models/service/installation.ts";
import { Status as ServiceStatus } from "@server/station/domain/models/service/status.ts";
import { StationId } from "@server/station/domain/models/service/station-id.ts";
import type { Id as ServiceIdVO } from "@server/station/domain/models/service/id.ts";
import type { Name as ServiceName } from "@server/station/domain/models/service/name.ts";
import type { BlueprintName } from "@server/station/domain/models/service/blueprint-name.ts";
import type { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import type { Inputs } from "@server/station/domain/models/service/inputs.ts";
import type { Secrets } from "@server/station/domain/models/service/secrets.ts";
import type { Instance } from "@server/station/domain/models/service/instance.ts";
import type { Host } from "@server/station/domain/models/service/host.ts";
import { StationRegistered } from "@server/station/domain/events/station-registered.ts";
import { StationUpdated } from "@server/station/domain/events/station-updated.ts";
import { StationUnregistered } from "@server/station/domain/events/station-unregistered.ts";
import { ServiceRegistered } from "@server/station/domain/events/service-registered.ts";
import { ServiceInstallStarted } from "@server/station/domain/events/service-install-started.ts";
import { ServiceInstallSucceeded } from "@server/station/domain/events/service-install-succeeded.ts";
import { ServiceInstallFailed } from "@server/station/domain/events/service-install-failed.ts";
import { ServiceInstallAborted } from "@server/station/domain/events/service-install-aborted.ts";
import { ServiceUnregistered } from "@server/station/domain/events/service-unregistered.ts";
import { ServiceUninstallStarted } from "@server/station/domain/events/service-uninstall-started.ts";
import { ServiceUninstalled } from "@server/station/domain/events/service-uninstalled.ts";
import { ServiceUninstallFailed } from "@server/station/domain/events/service-uninstall-failed.ts";
import { ServiceUninstallAborted } from "@server/station/domain/events/service-uninstall-aborted.ts";
import { ServiceAlreadyExists } from "@server/station/domain/exceptions/service-already-exists.ts";
import { ServiceNotFound } from "@server/station/domain/exceptions/service-not-found.ts";
import { ServiceNotRemovable } from "@server/station/domain/exceptions/service-not-removable.ts";

/**
 * Aggregate root for a complete topology grouping. A station is a logical
 * container (an operator's homelab, a multi-tenant cluster, a CI environment)
 * that owns the services installed within it.
 *
 * Services are entities inside this aggregate; mutations to a service go
 * through Station (`addService`, `unregisterService`, `installService`, etc.).
 * Station emits the corresponding domain events on its own bag.
 *
 * `status` is **derived** from internal services — there is no station-level
 * lifecycle of its own. A `InstallStation` session installs an operator-chosen
 * subset of services; per-service status fully captures the topology state.
 */
export class Station extends Aggregate {
  private _name: Name;
  private _description: Description;
  private readonly _services: Service[];

  constructor(
    readonly id: Id,
    name: Name,
    description: Description,
    creation: Creation,
    services: readonly Service[] = [],
    version?: Version,
  ) {
    super(creation, version);
    this._name = name;
    this._description = description;
    this._services = [...services];
  }

  get name(): Name {
    return this._name;
  }

  get description(): Description {
    return this._description;
  }

  /**
   * Derived from services. Empty station → REGISTERED. Any service INSTALLING
   * → INSTALLING. All INSTALLED → INSTALLED. Any FAILED (none installing) →
   * FAILED. Any ABORTED otherwise → ABORTED. Else REGISTERED (mix of
   * REGISTERED and INSTALLED is treated as still being set up).
   */
  get status(): Status {
    if (this._services.length === 0) return Status.REGISTERED;
    const statuses = this._services.map((s) => s.status);
    if (statuses.some((s) => s === ServiceStatus.INSTALLING)) return Status.INSTALLING;
    if (statuses.some((s) => s === ServiceStatus.UNINSTALLING)) return Status.UNINSTALLING;
    if (statuses.every((s) => s === ServiceStatus.INSTALLED)) return Status.INSTALLED;
    if (
      statuses.some((s) => s === ServiceStatus.FAILED || s === ServiceStatus.UNINSTALL_FAILED)
    ) {
      return Status.FAILED;
    }
    if (statuses.some((s) => s === ServiceStatus.ABORTED)) return Status.ABORTED;
    // UNINSTALLED services count as not-installed, like REGISTERED.
    return Status.REGISTERED;
  }

  get services(): readonly Service[] {
    return [...this._services];
  }

  serviceById(serviceId: ServiceId): Service {
    const service = this._services.find((s) => s.id.value === serviceId.value);
    if (!service) throw new ServiceNotFound();
    return service;
  }

  serviceByName(name: string): Service | null {
    return this._services.find((s) => s.name.value === name) ?? null;
  }

  static register(name: Name, description: Description, creation: Creation): Station {
    const station = new Station(new Id(), name, description, creation);
    station.events.push(new StationRegistered(station.id, name));
    return station;
  }

  /**
   * Rename / re-describe. Uniqueness of `name` is checked by the handler
   * against the repository.
   */
  update(name: Name, description: Description): void {
    const changed = name.value !== this._name.value ||
      description.value !== this._description.value;
    if (!changed) return;
    this._name = name;
    this._description = description;
    this.bump();
    this.events.push(new StationUpdated(this.id, name, description));
  }

  unregister(): void {
    this.bump();
    this.events.push(new StationUnregistered(this.id));
  }

  // ─── Service lifecycle (delegated to Service entity, events emitted here) ──

  addService(
    id: ServiceIdVO,
    name: ServiceName,
    blueprint: BlueprintName,
    vault: Vault,
    inputs: Inputs,
    secrets: Secrets,
    instances: readonly Instance[],
    host: Host | null,
    creation: Creation,
  ): Service {
    if (this._services.some((s) => s.name.value === name.value)) {
      throw new ServiceAlreadyExists();
    }
    if (this._services.some((s) => s.id.value === id.value)) {
      throw new ServiceAlreadyExists();
    }
    const service = new Service(
      id,
      name,
      blueprint,
      vault,
      inputs,
      secrets,
      instances,
      host,
      creation,
    );
    this._services.push(service);
    this.bump();
    this.events.push(
      new ServiceRegistered(
        service.id,
        new StationId(this.id.value),
        service.name,
        service.blueprint,
        service.instances,
        service.host,
      ),
    );
    return service;
  }

  unregisterService(serviceId: ServiceId): void {
    const index = this._services.findIndex((s) => s.id.value === serviceId.value);
    if (index === -1) throw new ServiceNotFound();
    if (!this._services[index].isRemovable) throw new ServiceNotRemovable();
    const [removed] = this._services.splice(index, 1);
    this.bump();
    this.events.push(new ServiceUnregistered(removed.id));
  }

  startServiceInstall(serviceId: ServiceId): void {
    const service = this.serviceById(serviceId);
    service.startInstall();
    this.bump();
    this.events.push(new ServiceInstallStarted(service.id));
  }

  installService(serviceId: ServiceId, installations: readonly Installation[]): void {
    const service = this.serviceById(serviceId);
    // The event carries the full results — the vault listener encrypts the
    // published secret values. The aggregate keeps only sanitized copies so
    // persistence never writes a secret value in cleartext.
    service.install(installations.map((d) => d.sanitized()));
    this.bump();
    this.events.push(
      new ServiceInstallSucceeded(
        service.id,
        service.name,
        service.blueprint,
        service.vault,
        installations,
      ),
    );
  }

  failService(serviceId: ServiceId, reason: string): void {
    const service = this.serviceById(serviceId);
    service.fail(reason);
    this.bump();
    this.events.push(new ServiceInstallFailed(service.id, reason));
  }

  abortService(serviceId: ServiceId): void {
    const service = this.serviceById(serviceId);
    service.abort();
    this.bump();
    this.events.push(new ServiceInstallAborted(service.id));
  }

  // ─── Service teardown (mirror of the install lifecycle) ────────────────────

  startServiceUninstall(serviceId: ServiceId): void {
    const service = this.serviceById(serviceId);
    service.startUninstall();
    this.bump();
    this.events.push(new ServiceUninstallStarted(service.id));
  }

  uninstallService(serviceId: ServiceId): void {
    const service = this.serviceById(serviceId);
    // Capture the installations that were torn down before clearing them — the
    // event carries them so vault/cluster listeners can clean up by host.
    const torn = service.installations;
    const event = new ServiceUninstalled(
      service.id,
      service.name,
      service.blueprint,
      service.vault,
      torn,
    );
    service.uninstalled();
    this.bump();
    this.events.push(event);
  }

  failServiceUninstall(serviceId: ServiceId, reason: string): void {
    const service = this.serviceById(serviceId);
    service.uninstallFailed(reason);
    this.bump();
    this.events.push(new ServiceUninstallFailed(service.id, reason));
  }

  abortServiceUninstall(serviceId: ServiceId): void {
    const service = this.serviceById(serviceId);
    service.uninstallAborted();
    this.bump();
    this.events.push(new ServiceUninstallAborted(service.id));
  }
}
