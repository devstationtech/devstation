import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import { InvalidPassword } from "@server/auth/domain/exceptions/invalid-password.ts";
import { WeakPassword } from "@server/auth/domain/exceptions/weak-password.ts";

/**
 * A provided master password. The constructor keeps the historical floor
 * (8 chars) so existing installations can still authenticate; `strong()` is
 * the policy for NEW passwords — `Configure` mints through it,
 * so the 16-char minimum applies whenever a password is set or rotated.
 */
export class Password implements ValueObject {
  static readonly STRONG_MINIMUM = 16;

  constructor(readonly value: string) {
    if (value.length < 8) throw new InvalidPassword();
  }

  /** Builds a password for setup/rotation, enforcing the strong policy. */
  static strong(value: string): Password {
    if (value.length < Password.STRONG_MINIMUM) {
      throw new WeakPassword(Password.STRONG_MINIMUM);
    }
    return new Password(value);
  }
}
