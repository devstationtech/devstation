export class SecretAlreadyExists extends Error {
  constructor() {
    super("secret already exists.");
  }
}
