import type { Id } from "@server/station/domain/models/service/id.ts";
import { ServiceInstallInProgress } from "@server/station/domain/exceptions/service-install-in-progress.ts";

/**
 * In-process registry of services with a install currently running.
 *
 * The Service FSM deliberately keeps `startInstall` idempotent so an operator
 * can re-trigger after a previous PROCESS died mid-install (status stuck in
 * INSTALLING with nobody driving it). That recovery property means the domain
 * cannot tell "stuck" from "actively running" — but this process can: every
 * inbound surface (TUI, RPC, MCP) runs in the single engine process, so a
 * live double-trigger is exactly a second claim on this registry. After a
 * crash the registry is empty and the documented re-trigger works unchanged.
 */
export class ActiveInstalls {
  private readonly running = new Set<string>();

  /** Claims the service for a install run; returns the release function. */
  claim(serviceId: Id): () => void {
    if (this.running.has(serviceId.value)) {
      throw new ServiceInstallInProgress(serviceId.value);
    }
    this.running.add(serviceId.value);
    return () => this.running.delete(serviceId.value);
  }

  /** Claims every service or none — a install session is all-or-nothing. */
  claimAll(serviceIds: readonly Id[]): () => void {
    const releases: Array<() => void> = [];
    try {
      for (const id of serviceIds) releases.push(this.claim(id));
    } catch (error) {
      for (const release of releases) release();
      throw error;
    }
    return () => {
      for (const release of releases) release();
    };
  }
}
