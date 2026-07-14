export class SecretsUnresolved extends Error {
  constructor(names: string[]) {
    super(`secrets unresolved: ${names.join(", ")}.`);
  }
}
