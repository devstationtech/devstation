export class ImageAlreadyExists extends Error {
  constructor() {
    super("image already exists.");
  }
}
