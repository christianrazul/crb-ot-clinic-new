/** Input broke a business rule. The message is shown to the user as is. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** The record does not exist, or the actor may not know it exists. */
export class NotFoundError extends Error {
  constructor(message = "We couldn't find that record. It may have been removed.") {
    super(message);
    this.name = "NotFoundError";
  }
}
