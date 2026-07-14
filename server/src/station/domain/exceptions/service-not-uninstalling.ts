export class ServiceNotUninstalling extends Error {
  constructor() {
    super("service is not currently being uninstalled.");
  }
}
