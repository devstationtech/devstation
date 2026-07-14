/**
 * Secret published by a step's `apply` generator. The installer captures the
 * value into the `InstallResult.secrets` map; the vault listener persists it
 * after the install finishes.
 */
export type Secret = {
  readonly type: "secret";
  readonly name: string;
  readonly value: string;
};
