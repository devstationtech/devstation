export class ServiceNotFound extends Error {
  constructor() {
    super("service not found.");
  }
}
