import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { parsePlanJson } from "@server/cluster/outbound/executions/proxmox/provisioning/plan-parser.ts";

describe("parsePlanJson", () => {
  it("should return zero counts for empty plan", () => {
    /* @Given a plan without resource_changes */
    const json = JSON.stringify({});
    /* @When parsed */
    const counts = parsePlanJson(json);
    /* @Then it returns counters at zero */
    assertEquals(counts, { toCreate: 0, toUpdate: 0, toDelete: 0 });
  });

  it("should count create actions per VM", () => {
    /* @Given a plan with 2 VMs to create */
    const json = JSON.stringify({
      resource_changes: [
        {
          address: 'module.vm["tl01"].proxmox_virtual_environment_vm.vm',
          change: { actions: ["create"] },
        },
        {
          address: 'module.vm["if01"].proxmox_virtual_environment_vm.vm',
          change: { actions: ["create"] },
        },
      ],
    });
    /* @When parsed */
    const counts = parsePlanJson(json);
    /* @Then counts 2 creates */
    assertEquals(counts, { toCreate: 2, toUpdate: 0, toDelete: 0 });
  });

  it("should deduplicate multiple resources of the same VM", () => {
    /* @Given a plan with two changes for the same VM (vm + random_password) */
    const json = JSON.stringify({
      resource_changes: [
        {
          address: 'module.vm["tl01"].proxmox_virtual_environment_vm.vm',
          change: { actions: ["create"] },
        },
        { address: 'random_password.vm_passwords["tl01"]', change: { actions: ["create"] } },
      ],
    });
    /* @When parsed */
    const counts = parsePlanJson(json);
    /* @Then counts only 1 create (random_password does not match the pattern) */
    assertEquals(counts, { toCreate: 1, toUpdate: 0, toDelete: 0 });
  });

  it("should count delete and update actions", () => {
    /* @Given a plan with delete and update */
    const json = JSON.stringify({
      resource_changes: [
        {
          address: 'module.vm["tl01"].proxmox_virtual_environment_vm.vm',
          change: { actions: ["delete"] },
        },
        {
          address: 'module.vm["if01"].proxmox_virtual_environment_vm.vm',
          change: { actions: ["update"] },
        },
      ],
    });
    /* @When parsed */
    const counts = parsePlanJson(json);
    /* @Then counts 1 update and 1 delete */
    assertEquals(counts, { toCreate: 0, toUpdate: 1, toDelete: 1 });
  });

  it("should treat replace (create+delete) as update", () => {
    /* @Given a plan with a replace */
    const json = JSON.stringify({
      resource_changes: [
        {
          address: 'module.vm["tl01"].proxmox_virtual_environment_vm.vm',
          change: { actions: ["create", "delete"] },
        },
      ],
    });
    /* @When parsed */
    const counts = parsePlanJson(json);
    /* @Then counts as 1 update */
    assertEquals(counts, { toCreate: 0, toUpdate: 1, toDelete: 0 });
  });

  it("should skip no-op changes", () => {
    /* @Given a plan with a no-op */
    const json = JSON.stringify({
      resource_changes: [
        {
          address: 'module.vm["tl01"].proxmox_virtual_environment_vm.vm',
          change: { actions: ["no-op"] },
        },
      ],
    });
    /* @When parsed */
    const counts = parsePlanJson(json);
    /* @Then it returns counters at zero */
    assertEquals(counts, { toCreate: 0, toUpdate: 0, toDelete: 0 });
  });
});
