import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  CloneStrategy,
  cloneStrategyFrom,
} from "@server/cluster/domain/models/proxmox/connection/clone-strategy.ts";
import { isLinked } from "@server/cluster/domain/models/proxmox/connection/clone-mode.ts";
import { ProvisioningPolicy } from "@server/cluster/domain/models/proxmox/connection/provisioning-policy.ts";

describe("CloneStrategy / cloneStrategyFrom", () => {
  it("should default to AUTO when value is missing", () => {
    /* @Given no value */
    /* @Then it should resolve to AUTO */
    assertEquals(cloneStrategyFrom(undefined), CloneStrategy.AUTO);
    assertEquals(cloneStrategyFrom(""), CloneStrategy.AUTO);
  });

  it("should map known wire values", () => {
    assertEquals(cloneStrategyFrom("linked"), CloneStrategy.LINKED);
    assertEquals(cloneStrategyFrom("full"), CloneStrategy.FULL);
  });

  it("should reject an unknown value", () => {
    assertThrows(() => cloneStrategyFrom("magic"), Error, "clone strategy");
  });
});

describe("isLinked", () => {
  it("should honor forced strategies regardless of storage type", () => {
    assertEquals(isLinked("dir", CloneStrategy.LINKED), true);
    assertEquals(isLinked("zfspool", CloneStrategy.FULL), false);
    assertEquals(isLinked(null, CloneStrategy.LINKED), true);
  });

  it("AUTO: CoW storage → linked", () => {
    for (const t of ["zfspool", "lvmthin", "btrfs", "rbd"]) {
      assertEquals(isLinked(t, CloneStrategy.AUTO), true, t);
    }
  });

  it("AUTO: non-CoW or unknown/null → full (correctness over space)", () => {
    for (const t of ["dir", "lvm", "nfs", "weird"]) {
      assertEquals(isLinked(t, CloneStrategy.AUTO), false, t);
    }
    assertEquals(isLinked(null, CloneStrategy.AUTO), false);
  });
});

describe("ProvisioningPolicy", () => {
  it("default() is auto + serial", () => {
    const p = ProvisioningPolicy.default();
    assertEquals(p.cloneStrategy, CloneStrategy.AUTO);
    assertEquals(p.parallelism, 1);
  });

  it("from() parses wire values with sane fallbacks", () => {
    assertEquals(
      ProvisioningPolicy.from(undefined, undefined).equals(ProvisioningPolicy.default()),
      true,
    );
    const p = ProvisioningPolicy.from("full", 4);
    assertEquals(p.cloneStrategy, CloneStrategy.FULL);
    assertEquals(p.parallelism, 4);
  });

  it("rejects non-positive / non-integer parallelism", () => {
    assertThrows(() => new ProvisioningPolicy(CloneStrategy.AUTO, 0), Error, "positive integer");
    assertThrows(() => new ProvisioningPolicy(CloneStrategy.AUTO, 1.5), Error, "positive integer");
  });

  it("equals compares both fields", () => {
    const a = ProvisioningPolicy.from("linked", 2);
    assertEquals(a.equals(ProvisioningPolicy.from("linked", 2)), true);
    assertEquals(a.equals(ProvisioningPolicy.from("linked", 3)), false);
    assertEquals(a.equals(ProvisioningPolicy.from("full", 2)), false);
  });
});
