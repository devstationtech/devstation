import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { VirtualMachines } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/virtual-machines.ts";
import { VirtualMachineId } from "@server/cluster/domain/models/proxmox/virtual-machine-id.ts";
import { Network } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/network.ts";
import { Ip } from "@server/cluster/domain/models/proxmox/nodes/ip.ts";
import { Gateway } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/gateway.ts";
import { Dns } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/dns.ts";
import { virtualMachine } from "@tests/cluster/fixtures/operations.ts";

/**
 * VirtualMachines is the per-node collection of VMs. Immutable —
 * register/unregister/clear return a new collection. The node
 * aggregate enforces vmid + ip uniqueness; this layer just provides
 * lookup + the immutable add/remove primitives.
 */

function net(ip: string): Network {
  return new Network(new Ip(ip), new Gateway("192.168.15.1"), new Dns("8.8.8.8"));
}

describe("VirtualMachines.has / byId", () => {
  it("byId returns the matching VM (or null when absent)", () => {
    /* @Given a collection with two VMs */
    const virtualMachines = new VirtualMachines([
      virtualMachine(101, "10.0.0.101"),
      virtualMachine(102, "10.0.0.102"),
    ]);
    /* @When byId is called */
    /* @Then the matching VM is returned and a miss yields null */
    assertEquals(virtualMachines.byId(new VirtualMachineId(101))?.id.value, 101);
    assertEquals(virtualMachines.byId(new VirtualMachineId(999)), null);
  });

  it("has() returns true for a present id, false otherwise", () => {
    const virtualMachines = new VirtualMachines([virtualMachine(101, "10.0.0.101")]);
    assertEquals(virtualMachines.has(new VirtualMachineId(101)), true);
    assertEquals(virtualMachines.has(new VirtualMachineId(999)), false);
  });
});

describe("VirtualMachines.hasIp / byIp", () => {
  it("byIp returns the VM that owns the given IP (or null)", () => {
    /* @Given a collection with a VM at 10.0.0.101 */
    const virtualMachines = new VirtualMachines([virtualMachine(101, "10.0.0.101")]);
    /* @When byIp is queried */
    assertEquals(virtualMachines.byIp(net("10.0.0.101"))?.network.ip.value, "10.0.0.101");
    assertEquals(virtualMachines.byIp(net("10.0.0.250")), null);
  });

  it("hasIp() reflects byIp's null contract", () => {
    const virtualMachines = new VirtualMachines([virtualMachine(101, "10.0.0.101")]);
    assertEquals(virtualMachines.hasIp(net("10.0.0.101")), true);
    assertEquals(virtualMachines.hasIp(net("10.0.0.250")), false);
  });
});

describe("VirtualMachines.register — immutability", () => {
  it("returns a NEW collection that includes the added VM; the original is unchanged", () => {
    /* @Given an empty collection */
    const empty = new VirtualMachines();
    /* @When a VM is registered */
    const updated = empty.register(virtualMachine(101, "10.0.0.101"));
    /* @Then the new collection has the VM AND the original is still empty */
    assertEquals(updated.length, 1);
    assertEquals(empty.length, 0);
  });

  it("preserves insertion order across multiple registrations", () => {
    /* @Given VMs registered in order [101, 102, 103] */
    const virtualMachines = new VirtualMachines()
      .register(virtualMachine(101, "10.0.0.101"))
      .register(virtualMachine(102, "10.0.0.102"))
      .register(virtualMachine(103, "10.0.0.103"));
    /* @Then the items preserve insertion order (used by tfvars determinism) */
    assertEquals(virtualMachines.items.map((vm) => vm.id.value), [101, 102, 103]);
  });
});

describe("VirtualMachines.unregister", () => {
  it("returns a NEW collection without the removed VM", () => {
    const virtualMachines = new VirtualMachines([
      virtualMachine(101, "10.0.0.101"),
      virtualMachine(102, "10.0.0.102"),
    ]);
    const after = virtualMachines.unregister(new VirtualMachineId(101));
    /* @Then 101 is gone from the new collection */
    assertEquals(after.has(new VirtualMachineId(101)), false);
    assertEquals(after.has(new VirtualMachineId(102)), true);
    /* @And the original still has both (immutable) */
    assertEquals(virtualMachines.length, 2);
  });

  it("unregistering a non-existent id is a no-op (returns equivalent collection)", () => {
    /* @Given a collection */
    const virtualMachines = new VirtualMachines([virtualMachine(101, "10.0.0.101")]);
    /* @When unregister is called with an unknown id */
    const after = virtualMachines.unregister(new VirtualMachineId(999));
    /* @Then the result is equivalent to the original (no throw, no change) */
    assertEquals(after.length, 1);
    assertEquals(after.has(new VirtualMachineId(101)), true);
  });
});

describe("VirtualMachines.clear / items", () => {
  it("clear() returns an empty collection (immutable — original survives)", () => {
    const virtualMachines = new VirtualMachines([virtualMachine(101, "10.0.0.101")]);
    const empty = virtualMachines.clear();
    assertEquals(empty.length, 0);
    assertEquals(virtualMachines.length, 1);
  });

  it("items returns a shallow copy — mutating it does NOT mutate the collection", () => {
    /* @Given a collection */
    const virtualMachines = new VirtualMachines([virtualMachine(101, "10.0.0.101")]);
    /* @When the caller mutates the snapshot */
    const snapshot = virtualMachines.items;
    (snapshot as unknown as { length: number }).length = 0;
    /* @Then the original collection is unchanged */
    assertEquals(virtualMachines.length, 1);
  });
});
