export class PasswordTooLong extends Error {
  constructor(maximum: number) {
    super(`password must be at most ${maximum} characters.`);
  }
}
