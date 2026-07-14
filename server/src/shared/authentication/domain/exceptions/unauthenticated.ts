export class Unauthenticated extends Error {
  constructor() {
    super("unauthenticated.");
  }
}
