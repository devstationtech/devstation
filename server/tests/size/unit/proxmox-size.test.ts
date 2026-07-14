import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { SizeFactory } from "@server/size/application/factories/size-factory.ts";
import { ProxmoxSize } from "@server/size/domain/models/proxmox/proxmox-size.ts";
import { Provider } from "@server/shared/building-blocks/domain/models/value-objects/provider.ts";
import { Id } from "@server/size/domain/models/id.ts";
import { Name } from "@server/size/domain/models/name.ts";
import { Cpu } from "@server/size/domain/models/proxmox/cpu.ts";
import { Ram } from "@server/size/domain/models/proxmox/ram.ts";
import { Disk } from "@server/size/domain/models/proxmox/disk.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import type { RegisterSize } from "@server/size/application/commands/register-size.ts";

/**
 * Size has two layers worth testing in isolation: the factory
 * dispatch (provider switch) and the ProxmoxSize aggregate
 * itself (Aggregate semantics + the Cpu/Ram/Disk Integer-derived VOs
 * which inherit "positive integer" validation).
 */

function aValidProxmoxCommand(overrides: Partial<RegisterSize> = {}): RegisterSize {
  return {
    name: "small-vm",
    provider: Provider.PROXMOX,
    user: "alice",
    host: "devstation",
    cpu: 2,
    ram: 2048,
    disk: 20,
    ...overrides,
  };
}

describe("SizeFactory.build — happy path", () => {
  it("returns a ProxmoxSize when the command targets the proxmox provider", () => {
    /* @Given a valid Proxmox command (cpu=2, ram=2048, disk=20) */
    const command = aValidProxmoxCommand();
    /* @When the factory builds the size */
    const def = SizeFactory.build(command);
    /* @Then it returns a ProxmoxSize with the same fields */
    assertEquals(def instanceof ProxmoxSize, true);
    assertEquals(def.name.value, "small-vm");
    assertEquals(def.provider, Provider.PROXMOX);
    if (def instanceof ProxmoxSize) {
      assertEquals(def.cpu.value, 2);
      assertEquals(def.ram.value, 2048);
      assertEquals(def.disk.value, 20);
    }
  });

  it("stamps creation metadata from the command's user/host (and an Instant of 'now')", () => {
    /* @Given a command from alice@devstation */
    const before = Date.now();
    const def = SizeFactory.build(
      aValidProxmoxCommand({ user: "alice", host: "devstation" }),
    );
    const after = Date.now();
    /* @Then creation.by and creation.hostname round-trip and at is within the wall-clock window */
    assertEquals(def instanceof ProxmoxSize, true);
    if (def instanceof ProxmoxSize) {
      assertEquals(def.creation.by.value, "alice");
      assertEquals(def.creation.hostname.value, "devstation");
      assertEquals(def.creation.at.date.getTime() >= before, true);
      assertEquals(def.creation.at.date.getTime() <= after, true);
    }
  });

  it("starts every new ProxmoxSize at version 1", () => {
    const def = SizeFactory.build(aValidProxmoxCommand());
    if (def instanceof ProxmoxSize) {
      assertEquals(def.version.value, 1);
    } else {
      throw new Error("expected ProxmoxSize");
    }
  });

  it("generates a unique Id per build (no shared identity across builds)", () => {
    const a = SizeFactory.build(aValidProxmoxCommand());
    const b = SizeFactory.build(aValidProxmoxCommand());
    assertEquals(a.id.value === b.id.value, false);
  });
});

describe("SizeFactory.build — validation propagation", () => {
  it("propagates Cpu validation: zero/negative/non-integer cpu rejected by Integer", () => {
    /* @When the command carries an invalid cpu */
    /* @Then the factory throws (it constructs Cpu inline, which rejects via Integer) */
    assertThrows(
      () => SizeFactory.build(aValidProxmoxCommand({ cpu: 0 })),
      Error,
      "positive",
    );
    assertThrows(() => SizeFactory.build(aValidProxmoxCommand({ cpu: -1 })), Error);
    assertThrows(() => SizeFactory.build(aValidProxmoxCommand({ cpu: 1.5 })), Error);
  });

  it("propagates Ram validation: zero/negative/non-integer ram rejected", () => {
    assertThrows(() => SizeFactory.build(aValidProxmoxCommand({ ram: 0 })), Error);
    assertThrows(() => SizeFactory.build(aValidProxmoxCommand({ ram: -512 })), Error);
  });

  it("propagates Disk validation: zero/negative disk rejected", () => {
    assertThrows(() => SizeFactory.build(aValidProxmoxCommand({ disk: 0 })), Error);
    assertThrows(() => SizeFactory.build(aValidProxmoxCommand({ disk: -10 })), Error);
  });

  it("propagates Name validation: empty/non-slug name rejected", () => {
    /* @Given an empty name */
    assertThrows(() => SizeFactory.build(aValidProxmoxCommand({ name: "" })), Error);
    /* @Given an uppercase name (not a valid Slug) */
    assertThrows(() => SizeFactory.build(aValidProxmoxCommand({ name: "VM" })), Error);
  });
});

describe("ProxmoxSize aggregate", () => {
  function aSize(): ProxmoxSize {
    return ProxmoxSize.register(
      new Id(),
      new Name("small"),
      new Cpu(2),
      new Ram(2048),
      new Disk(20),
      new Creation(
        new User("alice"),
        new Hostname("workstation"),
        Instant.fromString("2026-01-01T00:00:00.000Z"),
      ),
    );
  }

  it("declares Provider.PROXMOX (used by the factory dispatch + persistence)", () => {
    assertEquals(aSize().provider, Provider.PROXMOX);
  });

  it("ProxmoxSize.register is a convenience alias for the constructor (version=1)", () => {
    const def = aSize();
    assertEquals(def.version.value, 1);
    assertEquals(def.events.size, 0);
  });

  it("rehydration with an explicit version preserves it (e.g. loading from persistence)", async () => {
    /* @Given a state-restored ProxmoxSize with version 7 */
    const { Version } = await import(
      "@server/shared/building-blocks/domain/models/value-objects/version.ts"
    );
    const def = new ProxmoxSize(
      new Id(),
      new Name("rehydrated"),
      new Cpu(4),
      new Ram(4096),
      new Disk(40),
      new Creation(
        new User("alice"),
        new Hostname("h"),
        Instant.fromString("2026-01-01T00:00:00.000Z"),
      ),
      new Version(7),
    );
    /* @Then the version round-trips (not reset to 1) so updates increment from there */
    assertEquals(def.version.value, 7);
    assertEquals(def.name.value, "rehydrated");
  });
});
