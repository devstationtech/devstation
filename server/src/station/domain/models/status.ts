/**
 * Lifecycle stage of a station — reflects the outcome of the last
 * `InstallStation` orchestration run, not "everything currently up".
 *
 * Service-level liveness/health is a separate concern not tracked here.
 */
export enum Status {
  REGISTERED = "REGISTERED",
  INSTALLING = "INSTALLING",
  INSTALLED = "INSTALLED",
  FAILED = "FAILED",
  ABORTED = "ABORTED",
  UNINSTALLING = "UNINSTALLING",
}
