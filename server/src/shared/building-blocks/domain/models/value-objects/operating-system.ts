export enum OperatingSystem {
  UBUNTU_22_04 = "ubuntu-22-04",
  UBUNTU_24_04 = "ubuntu-24-04",
  DEBIAN_12 = "debian-12",
  DEBIAN_13 = "debian-13",
}

// The OS is its own model: it knows the set it supports and how to build itself
// from a raw wire/persistence string — validating the value the way a
// value-object constructor would. There is no separate "parse" helper; callers
// construct the VO via `OperatingSystem.from`, and an invalid value throws right
// there.
// deno-lint-ignore no-namespace
export namespace OperatingSystem {
  /** The supported OS values (the enum members, without the merged helpers). */
  export function values(): readonly OperatingSystem[] {
    return Object.values(OperatingSystem).filter(
      (v): v is OperatingSystem => typeof v === "string",
    );
  }

  export function from(value: string): OperatingSystem {
    if (!values().includes(value as OperatingSystem)) {
      throw new Error(`unsupported operating system: ${value}`);
    }
    return value as OperatingSystem;
  }
}
