export class InvalidTag extends Error {
  constructor() {
    super(
      "tag must be a lowercase slug (letters, digits, dot, hyphen or underscore) up to 50 characters.",
    );
  }
}
