import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import { InvalidPassword } from "@server/auth/domain/exceptions/invalid-password.ts";
import { WeakPassword } from "@server/auth/domain/exceptions/weak-password.ts";
import { PasswordTooLong } from "@server/auth/domain/exceptions/password-too-long.ts";

/**
 * A provided master password. The constructor enforces the 8-char floor and
 * the maximum; `strong()` is the policy entry point for NEW passwords —
 * `Configure` mints through it whenever a password is set or rotated.
 * The maximum bounds the input fed to the Argon2id derivation, so the
 * unauthenticated authenticate path cannot be handed arbitrarily large input.
 */
export class Password implements ValueObject {
  static readonly STRONG_MINIMUM = 8;
  static readonly MAXIMUM = 128;

  constructor(readonly value: string) {
    if (value.length < 8) throw new InvalidPassword();
    if (value.length > Password.MAXIMUM) {
      throw new PasswordTooLong(Password.MAXIMUM);
    }
  }

  /** Builds a password for setup/rotation, enforcing the strong policy. */
  static strong(value: string): Password {
    if (value.length < Password.STRONG_MINIMUM) {
      throw new WeakPassword(Password.STRONG_MINIMUM);
    }
    return new Password(value);
  }
}
