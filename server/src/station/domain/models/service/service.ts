import type { Entity } from "@server/shared/building-blocks/domain/models/entity.ts";
import type { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import type { Id } from "@server/station/domain/models/service/id.ts";
import type { Name } from "@server/station/domain/models/service/name.ts";
import type { BlueprintName } from "@server/station/domain/models/service/blueprint-name.ts";
import type { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import type { Secrets } from "@server/station/domain/models/service/secrets.ts";
import type { Inputs } from "@server/station/domain/models/service/inputs.ts";
import type { Instance } from "@server/station/domain/models/service/instance.ts";
import type { Host } from "@server/station/domain/models/service/host.ts";
import type { Installation } from "@server/station/domain/models/service/installation.ts";
import { Status } from "@server/station/domain/models/service/status.ts";
import { ServiceNotInstalling } from "@server/station/domain/exceptions/service-not-installing.ts";
import { ServiceNotUninstalling } from "@server/station/domain/exceptions/service-not-uninstalling.ts";

/**
 * Entity inside the Station aggregate. Two flavours:
 *
 * - **Standalone**: bound to one or more `instances` (each a `(role, host,
 *   credential)` triple); `host` is null.
 * - **Hosted**: declares a `host` reference to another service+role;
 *   `instances` is empty.
 *
 * Mutex invariant: instances vs host. Mutators (`startInstall`, `install`,
 * `fail`, `abort`) transit internal state only — the parent Station is
 * responsible for emitting the corresponding domain events on its bag.
 */
export class Service implements Entity {
  private _status: Status;
  private _installations: Installation[];
  private _failureReason: string | null;

  constructor(
    readonly id: Id,
    readonly name: Name,
    readonly blueprint: BlueprintName,
    readonly vault: Vault,
    readonly inputs: Inputs,
    readonly secrets: Secrets,
    readonly instances: readonly Instance[],
    readonly host: Host | null,
    readonly creation: Creation,
    status: Status = Status.REGISTERED,
    installations: readonly Installation[] = [],
    failureReason: string | null = null,
  ) {
    const hasInstances = instances.length > 0;
    const hasHost = host !== null;
    if (hasInstances && hasHost) {
      throw new Error("service cannot have both instances (standalone) and host (hosted).");
    }
    if (!hasInstances && !hasHost) {
      throw new Error("service must declare either instances (standalone) or host (hosted).");
    }
    this._status = status;
    this._installations = [...installations];
    this._failureReason = failureReason;
  }

  get status(): Status {
    return this._status;
  }

  get installations(): readonly Installation[] {
    return this._installations;
  }

  /** Why the last install FAILED — survives restarts so the operator can
   * diagnose without scrolling a long-gone execution log.
   * Null outside FAILED. */
  get failureReason(): string | null {
    return this._failureReason;
  }

  /** True for hosted services (declared with a host reference). */
  get isHosted(): boolean {
    return this.host !== null;
  }

  /**
   * Transition to INSTALLING. Idempotent — calling on a service already in
   * INSTALLING state is a no-op, which lets the operator re-trigger after a
   * previous run died mid-install (CLI process killed) without manual
   * recovery. Concurrent in-process double-trigger is prevented by the UI;
   * the domain doesn't need its own guard.
   */
  startInstall(): void {
    this._status = Status.INSTALLING;
    this._failureReason = null;
  }

  install(installations: readonly Installation[]): void {
    this.checkInstalling();
    this._status = Status.INSTALLED;
    this._installations = [...installations];
    this._failureReason = null;
  }

  fail(reason: string): void {
    this.checkInstalling();
    this._status = Status.FAILED;
    this._failureReason = reason;
  }

  abort(): void {
    this.checkInstalling();
    this._status = Status.ABORTED;
  }

  /**
   * Transition to UNINSTALLING. Like `startInstall`, lenient so the operator can
   * re-trigger teardown after a previous run died mid-uninstall. The handler
   * decides what is uninstallable; the parent Station emits the event.
   */
  startUninstall(): void {
    this._status = Status.UNINSTALLING;
    this._failureReason = null;
  }

  /** Teardown succeeded — the service holds no live installation anymore. */
  uninstalled(): void {
    this.checkUninstalling();
    this._status = Status.UNINSTALLED;
    this._installations = [];
    this._failureReason = null;
  }

  uninstallFailed(reason: string): void {
    this.checkUninstalling();
    this._status = Status.UNINSTALL_FAILED;
    this._failureReason = reason;
  }

  uninstallAborted(): void {
    this.checkUninstalling();
    this._status = Status.UNINSTALL_FAILED;
    this._failureReason = "uninstall aborted";
  }

  /**
   * A service may be unregistered only when it holds no live workload:
   * never installed (REGISTERED) or already torn down (UNINSTALLED).
   */
  get isRemovable(): boolean {
    return this._status === Status.REGISTERED || this._status === Status.UNINSTALLED;
  }

  private checkInstalling(): void {
    if (this._status !== Status.INSTALLING) throw new ServiceNotInstalling();
  }

  private checkUninstalling(): void {
    if (this._status !== Status.UNINSTALLING) throw new ServiceNotUninstalling();
  }
}
