export class StationNotFound extends Error {
  constructor() {
    super("station not found.");
  }
}
