import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

const SEMVER = /^\d+\.\d+\.\d+$/;

/**
 * Blueprint version, semver format `MAJOR.MINOR.PATCH`. Captured at install time
 * onto each `Installation.result.stack.version` so re-installs are detectable.
 */
export class SemVer implements ValueObject {
  constructor(readonly value: string) {
    if (!value) throw new Error("blueprint semver is required.");
    if (!SEMVER.test(value)) throw new Error("blueprint semver must be MAJOR.MINOR.PATCH.");
  }

  toString(): string {
    return this.value;
  }
}
