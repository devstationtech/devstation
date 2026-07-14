export class SizeAlreadyExists extends Error {
  constructor() {
    super("a size with that name already exists.");
  }
}
