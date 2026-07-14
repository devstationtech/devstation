export class WeakPassword extends Error {
  constructor(minimum: number) {
    super(`new passwords must be at least ${minimum} characters.`);
  }
}
