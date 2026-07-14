import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { UpdateVirtualMachineEndpoint } from "@server/cluster/inbound/rpc/proxmox/virtual-machine/update/endpoint.ts";
import type { UpdateVirtualMachineHandler } from "@server/cluster/application/handlers/proxmox/update-virtual-machine-handler.ts";
import type { UpdateVirtualMachine } from "@server/cluster/application/commands/proxmox/update-virtual-machine.ts";
import type { ClusterProxmoxVirtualMachineUpdateRequest } from "@jsonrpc-contracts-ts/cluster.gen.ts";

/**
 * `cluster.proxmox.virtualMachine.update` endpoint — thin inbound adapter. Pins
 * the request→command field mapping (all 16 positional fields) + the
 * `tags` optional branch (present copies the array, absent → []), and
 * the empty-ack response.
 */

// deno-lint-ignore no-explicit-any
type Anyish = any;

function fakeHandler(): { handler: UpdateVirtualMachineHandler; calls: UpdateVirtualMachine[] } {
  const calls: UpdateVirtualMachine[] = [];
  const handler = {
    handle(cmd: UpdateVirtualMachine): Promise<void> {
      calls.push(cmd);
      return Promise.resolve();
    },
  } as Anyish as UpdateVirtualMachineHandler;
  return { handler, calls };
}

const REQUEST: ClusterProxmoxVirtualMachineUpdateRequest = {
  sessionId: "sess",
  clusterId: "c1",
  nodeId: "n1",
  id: 101,
  name: "k3s-server",
  size: "def-1",
  image: "img-1",
  ip: "10.0.0.5",
  gateway: "10.0.0.1",
  dns: "10.0.0.1",
  storage: "local-lvm",
  cpu: 2,
  ram: 2048,
  disk: 20,
  credentialVaultId: "v1",
  usernameSecretId: "u1",
  passwordSecretId: "p1",
  tags: ["k3s", "server"],
} as Anyish;

describe("UpdateVirtualMachineEndpoint", () => {
  it("declares the method literal", () => {
    const { handler } = fakeHandler();
    assertEquals(
      new UpdateVirtualMachineEndpoint(handler).method,
      "cluster.proxmox.virtualMachine.update",
    );
  });

  it("maps every request field onto the UpdateVirtualMachine command", async () => {
    /* @Given a full update request */
    const { handler, calls } = fakeHandler();
    /* @When dispatched */
    const ack = await new UpdateVirtualMachineEndpoint(handler).dispatch(REQUEST);
    /* @Then the handler ran once with a faithfully-mapped command */
    assertEquals(calls.length, 1);
    const cmd = calls[0];
    assertEquals([cmd.clusterId, cmd.nodeId, cmd.id], ["c1", "n1", 101]);
    assertEquals([cmd.name, cmd.size, cmd.image], ["k3s-server", "def-1", "img-1"]);
    assertEquals([cmd.ip, cmd.gateway, cmd.dns], ["10.0.0.5", "10.0.0.1", "10.0.0.1"]);
    assertEquals([cmd.cpu, cmd.ram, cmd.disk], [2, 2048, 20]);
    assertEquals(cmd.storage, "local-lvm");
    assertEquals([cmd.credentialVaultId, cmd.usernameSecretId, cmd.passwordSecretId], [
      "v1",
      "u1",
      "p1",
    ]);
    assertEquals(cmd.tags, ["k3s", "server"]);
    /* @And the response is an empty ack */
    assertEquals(ack, {});
  });

  it("copies the tags array (caller mutation cannot reach the command)", async () => {
    /* @Given a request whose tags array is mutated after dispatch */
    const { handler, calls } = fakeHandler();
    const tags = ["a", "b"];
    await new UpdateVirtualMachineEndpoint(handler).dispatch({ ...REQUEST, tags } as Anyish);
    tags.push("evil");
    /* @Then the command kept its own copy */
    assertEquals(calls[0].tags, ["a", "b"]);
  });

  it("defaults tags to [] when the request omits them", async () => {
    /* @Given a request with no tags field */
    const { handler, calls } = fakeHandler();
    const { tags: _omit, ...noTags } = REQUEST;
    await new UpdateVirtualMachineEndpoint(handler).dispatch(noTags as Anyish);
    /* @Then the command carries an empty tags array */
    assertEquals(calls[0].tags, []);
  });
});
