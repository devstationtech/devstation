export class VaultNotFound extends Error {
  constructor() {
    super("vault not found.");
  }
}
