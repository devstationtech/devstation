import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { CapacityPreflight } from "@server/cluster/outbound/executions/proxmox/capacity-preflight.ts";
import type { ProxmoxReadApiFactory } from "@server/cluster/application/queries/proxmox/api/factory.ts";
import type { ProxmoxReadApi } from "@server/cluster/application/queries/proxmox/api/proxmox-read-api.ts";
import {
  proxmoxNodeWithVirtualMachines,
  virtualMachine,
} from "@tests/cluster/fixtures/operations.ts";
import { Connection } from "@server/cluster/domain/models/proxmox/connection/connection.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";

const GIB = 1024 * 1024 * 1024;
const connection = () => new Connection(new Hostname("h"), new Vault("v"), new Secret("s"));

// deno-lint-ignore no-explicit-any
const factory = (
  storages: { id: string; type: string; available: number }[] | null,
): ProxmoxReadApiFactory => ({
  create: () =>
    Promise.resolve(
      storages === null ? null : ({
        storages: () => Promise.resolve(storages.map((s) => ({ ...s, total: s.available }))),
      } as unknown as ProxmoxReadApi),
    ),
});

// virtualMachine() defaults: disk 10 GiB, storage "s1"
const node = () => proxmoxNodeWithVirtualMachines();
const virtualMachines = () => [virtualMachine()];

describe("CapacityPreflight", () => {
  it("warns when required disk exceeds free space", async () => {
    /* @Given a datastore with less free space than the VM disk needs */
    const p = new CapacityPreflight(
      factory([{ id: "s1", type: "dir", available: 5 * GIB }]),
    );
    /* @When preflight inspects the planned VMs */
    const out = await p.warnings(connection(), node(), virtualMachines());
    /* @Then it surfaces a provisioning-may-fail warning */
    assertEquals(out.length, 1);
    assertEquals(out[0].includes("provisioning may fail"), true);
  });

  it("warns on a tight non-sparse zfspool (heuristic)", async () => {
    /* @Given a zfspool with barely enough room for the non-sparse disk */
    const p = new CapacityPreflight(
      factory([{ id: "s1", type: "zfspool", available: 11 * GIB }]),
    );
    /* @When preflight inspects the planned VMs */
    const out = await p.warnings(connection(), node(), virtualMachines());
    /* @Then it warns the pool is not sparse */
    assertEquals(out.length, 1);
    assertEquals(out[0].includes("not sparse"), true);
  });

  it("is silent when there is plenty of space", async () => {
    /* @Given a datastore with ample free space */
    const p = new CapacityPreflight(
      factory([{ id: "s1", type: "zfspool", available: 500 * GIB }]),
    );
    /* @Then no warnings are produced */
    assertEquals((await p.warnings(connection(), node(), virtualMachines())).length, 0);
  });

  it("degrades to no warnings when the api is unavailable", async () => {
    /* @Given the read API cannot be created */
    const p = new CapacityPreflight(factory(null));
    /* @Then preflight degrades gracefully to no warnings */
    assertEquals((await p.warnings(connection(), node(), virtualMachines())).length, 0);
  });

  it("ignores datastores it cannot see", async () => {
    /* @Given the API only reports a datastore the VMs do not use */
    const p = new CapacityPreflight(
      factory([{ id: "other", type: "dir", available: 1 }]),
    );
    /* @Then unrelated datastores are ignored, so no warnings */
    assertEquals((await p.warnings(connection(), node(), virtualMachines())).length, 0);
  });
});
