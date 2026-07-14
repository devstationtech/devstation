/**
 * A installed service cannot be unregistered without tearing it down first —
 * otherwise the running workload is silently orphaned. Removal is allowed only
 * when the service was never installed (REGISTERED) or already uninstalled
 * (UNINSTALLED).
 */
export class ServiceNotRemovable extends Error {
  constructor() {
    super("service must be uninstalled before it can be removed.");
  }
}
