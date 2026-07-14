import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

/**
 * Outcome of a single role's install run. Carries:
 *
 * - `blueprint.version`: identity of the blueprint version that was installed
 *   (used by re-install detection and audit).
 * - `secrets`: tokens/credentials produced by the install. Vault listener
 *   persists them under `<serviceId>-<role.name>-<secretName>`. The vault is
 *   their only durable home — aggregate state keeps a `sanitized()` copy.
 * - `outputs`: non-secret data (IPs, hostnames, ports). Safe to expose in UI.
 *
 * Both `secrets` and `outputs` are flat string maps to keep persistence and
 * event payloads simple.
 */
export class InstallResult implements ValueObject {
  constructor(
    readonly blueprint: { readonly version: string },
    readonly secrets: Readonly<Record<string, string>>,
    readonly outputs: Readonly<Record<string, string>>,
  ) {
    if (!blueprint.version) throw new Error("install result blueprint.version is required.");
  }

  /**
   * Copy with the secret values dropped. The install event carries the full
   * result so the vault listener can encrypt the values; what the aggregate
   * keeps (and persistence writes) must never hold them in cleartext.
   */
  sanitized(): InstallResult {
    return new InstallResult(this.blueprint, {}, this.outputs);
  }
}
