export class SecretNotFound extends Error {
  constructor() {
    super("secret not found.");
  }
}
