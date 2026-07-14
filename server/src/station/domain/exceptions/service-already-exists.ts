export class ServiceAlreadyExists extends Error {
  constructor() {
    super("a service with this name already exists.");
  }
}
