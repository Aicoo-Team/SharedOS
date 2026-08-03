export class DuplicateRegistrationError extends Error {
  override readonly name = "DuplicateRegistrationError";

  constructor(kind: "resource namespace" | "tool", identifier: string) {
    super(`${kind} is already registered: ${identifier}`);
  }
}

export class MissingRegistrationError extends Error {
  override readonly name = "MissingRegistrationError";

  constructor(kind: "resource namespace" | "tool", identifier: string) {
    super(`${kind} is not registered: ${identifier}`);
  }
}
