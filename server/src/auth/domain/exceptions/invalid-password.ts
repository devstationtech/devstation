export class InvalidPassword extends Error {
  constructor() {
    super("password must be at least 8 characters.");
  }
}
