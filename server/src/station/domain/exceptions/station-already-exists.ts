export class StationAlreadyExists extends Error {
  constructor() {
    super("a station with that name is already registered.");
  }
}
