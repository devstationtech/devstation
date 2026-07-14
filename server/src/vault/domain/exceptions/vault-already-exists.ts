export class VaultAlreadyExists extends Error {
  constructor() {
    super("a vault with that name already exists.");
  }
}
