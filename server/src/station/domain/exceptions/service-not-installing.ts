export class ServiceNotInstalling extends Error {
  constructor() {
    super("service is not currently installing.");
  }
}
