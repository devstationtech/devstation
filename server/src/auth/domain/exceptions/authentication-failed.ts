export class AuthenticationFailed extends Error {
  constructor() {
    super("authentication failed.");
  }
}
