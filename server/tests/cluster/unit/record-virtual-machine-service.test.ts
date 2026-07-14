import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Service } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/services/service.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import {
  nodeImage,
  register,
  registerNode,
  virtualMachine,
} from "@tests/cluster/fixtures/operations.ts";

/** Build a cluster with one node + a VM at the given IP, fully registered. */
function clusterWithVirtualMachine(host: string, virtualMachineId = 101) {
  const cluster = register();
  const node = registerNode("cp4", "192.168.15.194");
  cluster.registerNode(node);
  cluster.assignImage(node.id, nodeImage());
  const vm = virtualMachine(virtualMachineId, host);
  cluster.registerVirtualMachine(node.id, vm);
  return { cluster, node, vm };
}

/**
 * `ProxmoxCluster.recordVirtualMachineService(host, service)` is the projection
 * the cluster BC keeps so the UI can answer "what's running on this
 * VM?". Pin the contract:
 *  - matches the VM by IP (`host`); upserts the service by
 *    (serviceId, role);
 *  - returns true when a VM matched (so the handler persists), false
 *    when no VM matched (handler skips the update);
 *  - re-installs of the same (serviceId, role) OVERWRITE; different
 *    roles APPEND.
 */

function aService(opts: { id?: string; role?: string; name?: string } = {}): Service {
  return new Service(
    opts.id ?? "svc-1",
    opts.name ?? "homelab-k3s",
    "k3s",
    opts.role ?? "server",
    Instant.fromString("2026-01-01T00:00:00.000Z"),
  );
}

describe("ProxmoxCluster.recordVirtualMachineService", () => {
  it("returns true and appends the service when a VM matches the host IP", () => {
    /* @Given a cluster with one node and one VM at 10.0.0.101 */
    const { cluster, node, vm } = clusterWithVirtualMachine("10.0.0.101");

    /* @When recordVirtualMachineService is called with the VM's IP */
    const matched = cluster.recordVirtualMachineService("10.0.0.101", aService());

    /* @Then it returns true (the handler persists this cluster) */
    assertEquals(matched, true);
    /* @And the service is recorded on the matching VM */
    const recorded = cluster.nodes.of(node.id).virtualMachines.byId(vm.id)!;
    assertEquals(recorded.services.length, 1);
    assertEquals(recorded.services[0].serviceId, "svc-1");
  });

  it("returns false when no VM in any node matches the host IP", () => {
    /* @Given a cluster with one VM at a different IP */
    const { cluster } = clusterWithVirtualMachine("10.0.0.101");

    /* @When recordVirtualMachineService is called with an IP no VM holds */
    const matched = cluster.recordVirtualMachineService("10.0.0.250", aService());

    /* @Then it returns false (caller skips this cluster) */
    assertEquals(matched, false);
  });

  it("OVERWRITES the existing entry when the same (serviceId, role) re-installs", () => {
    /* @Given a VM with a service already recorded */
    const { cluster, node, vm } = clusterWithVirtualMachine("10.0.0.101");
    cluster.recordVirtualMachineService("10.0.0.101", aService({ id: "svc-1", role: "server" }));

    /* @When the same (serviceId, role) records again */
    cluster.recordVirtualMachineService(
      "10.0.0.101",
      new Service(
        "svc-1",
        "homelab-k3s-renamed",
        "k3s",
        "server",
        Instant.fromString("2026-01-02T00:00:00.000Z"),
      ),
    );

    /* @Then there is still exactly one entry (overwrite, not duplicate) */
    const recorded = cluster.nodes.of(node.id).virtualMachines.byId(vm.id)!;
    assertEquals(recorded.services.length, 1);
    assertEquals(recorded.services[0].serviceName, "homelab-k3s-renamed");
  });

  it("APPENDS a different role of the same service (multi-role services share a VM)", () => {
    /* @Given a VM with service 'svc-1' role 'server' already recorded */
    const { cluster, node, vm } = clusterWithVirtualMachine("10.0.0.101");
    cluster.recordVirtualMachineService("10.0.0.101", aService({ role: "server" }));

    /* @When a DIFFERENT role of the same serviceId is recorded */
    cluster.recordVirtualMachineService("10.0.0.101", aService({ role: "agent" }));

    /* @Then both roles coexist (append, not overwrite — same VM hosts both) */
    const recorded = cluster.nodes.of(node.id).virtualMachines.byId(vm.id)!;
    assertEquals(recorded.services.length, 2);
    const roles = recorded.services.map((s) => s.role).sort();
    assertEquals(roles, ["agent", "server"]);
  });
});
