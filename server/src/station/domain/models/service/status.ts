/**
 * Lifecycle stage of a service. Mirrors the domain events: each transition
 * sets a new status and pushes the matching event.
 */
export enum Status {
  REGISTERED = "REGISTERED",
  INSTALLING = "INSTALLING",
  INSTALLED = "INSTALLED",
  FAILED = "FAILED",
  ABORTED = "ABORTED",
  UNINSTALLING = "UNINSTALLING",
  UNINSTALLED = "UNINSTALLED",
  UNINSTALL_FAILED = "UNINSTALL_FAILED",
}
