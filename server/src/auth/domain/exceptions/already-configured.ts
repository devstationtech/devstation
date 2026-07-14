export class AlreadyConfigured extends Error {
  constructor() {
    super("a master password is already configured.");
  }
}
