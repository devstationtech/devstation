import { assert, assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import { Id } from "@server/cluster/domain/models/id.ts";
import { Name } from "@server/cluster/domain/models/name.ts";
import { InvalidNodeStateTransition } from "@server/cluster/domain/exceptions/invalid-node-state-transition.ts";
import { NodeAlreadyExists } from "@server/cluster/domain/exceptions/node-already-exists.ts";
import { NodeHasVirtualMachines } from "@server/cluster/domain/exceptions/node-has-virtual-machines.ts";
import { NodeNotFound } from "@server/cluster/domain/exceptions/node-not-found.ts";
import { State } from "@server/cluster/domain/models/proxmox/nodes/state.ts";
import { VirtualMachineNotFound } from "@server/cluster/domain/exceptions/virtual-machine-not-found.ts";
import { VirtualMachineAlreadyExists } from "@server/cluster/domain/exceptions/virtual-machine-already-exists.ts";
import { NodeBusy } from "@server/cluster/domain/exceptions/node-busy.ts";
import { NodeNotInterrupted } from "@server/cluster/domain/exceptions/node-not-interrupted.ts";
import { VirtualMachineId } from "@server/cluster/domain/models/proxmox/virtual-machine-id.ts";
import { Nodes as ProxmoxNodes } from "@server/cluster/domain/models/proxmox/nodes/nodes.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import { Name as NodeName } from "@server/cluster/domain/models/proxmox/nodes/name.ts";
import { Ip } from "@server/cluster/domain/models/proxmox/nodes/ip.ts";
import { Node as ProxmoxNode } from "@server/cluster/domain/models/proxmox/nodes/node.ts";
import { ImageAssignedToNode } from "@server/cluster/domain/events/image-assigned-to-node.ts";
import { ImageUnassignedFromNode } from "@server/cluster/domain/events/image-unassigned-from-node.ts";
import {
  connection,
  creation,
  nodeImage,
  proxmoxNodeWithVirtualMachines,
  register,
  registerNode,
  testCredential,
  virtualMachine,
} from "@tests/cluster/fixtures/operations.ts";

describe("Cluster.register", () => {
  it("should register a new cluster", () => {
    /* @Given valid registration parameters */
    const cluster = register("homelab-dev");

    /* @When the registration is executed */
    /* @Then the cluster should hold the given data */
    assert(cluster.id.value.length > 0);
    assertEquals(cluster.name.value, "homelab-dev");
    assertEquals(cluster.creation.by.value, "test-user");
    assertEquals(cluster.creation.hostname.value, "test-host");
    assertEquals(cluster.version.value, 1);
    assertEquals(cluster.nodes.items.length, 0);
    assert(cluster.creation.at.toString() != null);
  });
});

describe("Cluster.name", () => {
  it("should reject an empty name", () => {
    /* @Given an empty name */
    /* @When the cluster is created */
    /* @Then an exception should be thrown */
    assertThrows(() => register(""), Error, "Value is required");
  });

  it("should reject a name outside the slug format", () => {
    /* @Given a name outside the slug format */
    /* @When the cluster is created */
    /* @Then an exception should be thrown */
    assertThrows(() => register("Invalid Cluster!"), Error, "lowercase slug");
  });
});

describe("Cluster.creation", () => {
  it("should reject an empty user", () => {
    /* @Given an empty user at creation */
    /* @When the cluster is created */
    /* @Then an exception should be thrown */
    assertThrows(() => register("homelab-dev", "", "test-host"), Error, "user is required");
  });

  it("should reject an empty hostname", () => {
    /* @Given an empty hostname at creation */
    /* @When the cluster is created */
    /* @Then an exception should be thrown */
    assertThrows(() => register("homelab-dev", "test-user", ""), Error, "hostname is required");
  });
});

describe("Cluster.registerNode", () => {
  it("should register a node and bump version", () => {
    /* @Given an empty cluster */
    const cluster = register();
    const node = registerNode("node-1", "192.168.1.1");

    /* @When the node is registered */
    cluster.registerNode(node);

    /* @Then the cluster should contain the node and the version should be incremented */
    assertEquals(cluster.nodes.items.length, 1);
    assertEquals(cluster.nodes.items[0].name.value, "node-1");
    assertEquals(cluster.nodes.items[0].ip.value, "192.168.1.1");
    assertEquals(cluster.version.value, 2);
  });

  it("should reject a duplicate node name", () => {
    /* @Given a cluster with an already registered node */
    const cluster = register();
    cluster.registerNode(registerNode("node-1", "192.168.1.1"));

    /* @When a second node with the same name is registered */
    /* @Then NodeNameAlreadyExists should be thrown */
    assertThrows(
      () => cluster.registerNode(registerNode("node-1", "192.168.1.2")),
      NodeAlreadyExists,
    );
  });

  it("should reject a duplicate node address", () => {
    /* @Given a cluster with an already registered node */
    const cluster = register();
    cluster.registerNode(registerNode("node-1", "192.168.1.1"));

    /* @When a second node with the same address is registered */
    /* @Then NodeAddressAlreadyExists should be thrown */
    assertThrows(
      () => cluster.registerNode(registerNode("node-2", "192.168.1.1")),
      NodeAlreadyExists,
    );
  });

  it("should expose a defensive copy of nodes", () => {
    /* @Given a cluster with one node */
    const cluster = register();
    cluster.registerNode(registerNode());

    /* @When the returned collection is modified externally */
    (cluster.nodes.items as unknown as Array<unknown>).pop();

    /* @Then the cluster's internal state should not be affected */
    assertEquals(cluster.nodes.items.length, 1);
  });
});

describe("Cluster.replaceNode", () => {
  it("should replace name and address and bump version", () => {
    /* @Given a cluster with a registered node */
    const cluster = register();
    const node = registerNode("node-1", "192.168.1.1");
    cluster.registerNode(node);

    /* @When the node is replaced with new data */
    const replacement = new ProxmoxNode(
      node.id,
      new NodeName("node-1-v2"),
      new Ip("192.168.1.99"),
      testCredential(),
    );
    cluster.replaceNode(node.id, replacement);

    /* @Then the node should reflect the new data and the version should be incremented */
    assertEquals(cluster.nodes.items[0].name.value, "node-1-v2");
    assertEquals(cluster.version.value, 3);
  });

  it("should preserve virtualMachines when replacement includes them", () => {
    /* @Given a cluster with one node with active instances */
    const nodeWithVirtualMachine = proxmoxNodeWithVirtualMachines("node-1", "192.168.1.1");
    const cluster = new ProxmoxCluster(
      new Id(),
      new Name("test-cluster"),
      creation(),
      new ProxmoxNodes([nodeWithVirtualMachine]),
    );

    /* @When the node is replaced preserving the instances */
    const replacement = new ProxmoxNode(
      nodeWithVirtualMachine.id,
      new NodeName("node-1-v2"),
      new Ip("10.0.0.99"),
      testCredential(),
      (nodeWithVirtualMachine as ProxmoxNode).images,
      (nodeWithVirtualMachine as ProxmoxNode).virtualMachines,
    );
    cluster.replaceNode(nodeWithVirtualMachine.id, replacement);

    /* @Then the original node's instances should be preserved */
    const node = cluster.nodes.items[0];
    assertEquals(node.virtualMachines.length, 1);
  });

  it("should allow replacing with the same name and address", () => {
    /* @Given a cluster with a registered node */
    const cluster = register();
    const node = registerNode("node-1", "192.168.1.1");
    cluster.registerNode(node);

    /* @When the node is replaced with the same data */
    /* @Then no exception should be thrown */
    const replacement = new ProxmoxNode(
      node.id,
      new NodeName("node-1"),
      new Ip("192.168.1.1"),
      testCredential(),
    );
    cluster.replaceNode(node.id, replacement);
    assertEquals(cluster.nodes.items[0].name.value, "node-1");
  });

  it("should reject replace with name used by another node", () => {
    /* @Given a cluster with two nodes */
    const cluster = register();
    cluster.registerNode(registerNode("node-1", "192.168.1.1"));
    const node2 = registerNode("node-2", "192.168.1.2");
    cluster.registerNode(node2);

    /* @When the second node is replaced with the first node's name */
    /* @Then NodeNameAlreadyExists should be thrown */
    const replacement = new ProxmoxNode(
      node2.id,
      new NodeName("node-1"),
      new Ip("192.168.1.99"),
      testCredential(),
    );
    assertThrows(
      () => cluster.replaceNode(node2.id, replacement),
      NodeAlreadyExists,
    );
  });

  it("should reject replace with address used by another node", () => {
    /* @Given a cluster with two nodes */
    const cluster = register();
    cluster.registerNode(registerNode("node-1", "192.168.1.1"));
    const node2 = registerNode("node-2", "192.168.1.2");
    cluster.registerNode(node2);

    /* @When the second node is replaced with the first node's address */
    /* @Then NodeAddressAlreadyExists should be thrown */
    const replacement = new ProxmoxNode(
      node2.id,
      new NodeName("node-2-v2"),
      new Ip("192.168.1.1"),
      testCredential(),
    );
    assertThrows(
      () => cluster.replaceNode(node2.id, replacement),
      NodeAlreadyExists,
    );
  });

  it("should throw NodeNotFound for unknown node id", () => {
    /* @Given an empty cluster */
    const cluster = register();
    const unknownId = new NodeId();

    /* @When attempting to replace a nonexistent node */
    /* @Then NodeNotFound should be thrown */
    const replacement = new ProxmoxNode(
      unknownId,
      new NodeName("node-x"),
      new Ip("10.0.0.1"),
      testCredential(),
    );
    assertThrows(
      () => cluster.replaceNode(unknownId, replacement),
      NodeNotFound,
    );
  });
});

describe("Cluster.unregisterNode", () => {
  it("should remove a node and bump version", () => {
    /* @Given a cluster with a registered node */
    const cluster = register();
    const node = registerNode();
    cluster.registerNode(node);

    /* @When the node is removed */
    cluster.unregisterNode(node.id);

    /* @Then the cluster should become empty and the version should be incremented */
    assertEquals(cluster.nodes.items.length, 0);
    assertEquals(cluster.version.value, 3);
  });

  it("should throw NodeNotFound for unknown node id", () => {
    /* @Given an empty cluster */
    const cluster = register();

    /* @When attempting to remove a nonexistent node */
    /* @Then NodeNotFound should be thrown */
    assertThrows(
      () => cluster.unregisterNode(new NodeId()),
      NodeNotFound,
    );
  });

  it("should throw NodeHasVirtualMachines when node has active virtualMachines", () => {
    /* @Given a cluster with one node with active instances */
    const nodeWithVirtualMachine = proxmoxNodeWithVirtualMachines("node-1", "192.168.1.1");
    const cluster = new ProxmoxCluster(
      new Id(),
      new Name("test-cluster"),
      creation(),
      new ProxmoxNodes([nodeWithVirtualMachine]),
    );

    /* @When attempting to remove the node with instances */
    /* @Then NodeHasVirtualMachines should be thrown */
    assertThrows(
      () => cluster.unregisterNode(nodeWithVirtualMachine.id),
      NodeHasVirtualMachines,
    );
  });
});

describe("Cluster.unregisterAllNodes", () => {
  it("should remove all nodes and bump version", () => {
    /* @Given a cluster with two nodes */
    const cluster = register();
    cluster.registerNode(registerNode("node-1", "192.168.1.1"));
    cluster.registerNode(registerNode("node-2", "192.168.1.2"));

    /* @When all nodes are removed */
    cluster.unregisterAllNodes();

    /* @Then the cluster should become empty and the version should be incremented */
    assertEquals(cluster.nodes.items.length, 0);
    assertEquals(cluster.version.value, 4);
  });

  it("should throw NodeHasVirtualMachines and not remove any node", () => {
    /* @Given a cluster with one node with active instances */
    const nodeWithVirtualMachine = proxmoxNodeWithVirtualMachines("node-1", "192.168.1.1");
    const cluster = new ProxmoxCluster(
      new Id(),
      new Name("test-cluster"),
      creation(),
      new ProxmoxNodes([nodeWithVirtualMachine]),
    );

    /* @When attempting to remove all nodes */
    /* @Then NodeHasVirtualMachines should be thrown without removing any node */
    assertThrows(
      () => cluster.unregisterAllNodes(),
      NodeHasVirtualMachines,
    );
    assertEquals(cluster.nodes.items.length, 1);
  });
});

describe("Cluster.registerVirtualMachine", () => {
  it("should add an virtualMachine to the node and bump version", () => {
    /* @Given a cluster with a registered node and an image of that node */
    const cluster = register();
    const node = registerNode("node-1", "192.168.1.1");
    cluster.registerNode(node);
    cluster.assignImage(node.id, nodeImage());

    /* @When a virtualMachine is registered on the node */
    cluster.registerVirtualMachine(node.id, virtualMachine(100, "10.0.0.100"));

    /* @Then the node should contain the virtualMachine and the version should be incremented */
    const host = cluster.nodes.items[0];
    assertEquals(host.virtualMachines.length, 1);
    assertEquals(cluster.version.value, 4);
  });

  it("should throw NodeNotFound for unknown node id", () => {
    /* @Given a cluster without the target node */
    const cluster = register();

    /* @When attempting to register a virtualMachine on a nonexistent node */
    /* @Then NodeNotFound should be thrown */
    assertThrows(
      () => cluster.registerVirtualMachine(new NodeId(), virtualMachine()),
      NodeNotFound,
    );
  });

  it("should throw VirtualMachineIdAlreadyExists for duplicate id", () => {
    /* @Given a cluster with a node that already has a virtualMachine */
    const cluster = register();
    const node = registerNode("node-1", "192.168.1.1");
    cluster.registerNode(node);
    cluster.assignImage(node.id, nodeImage());
    const vm = virtualMachine(100, "10.0.0.100");
    cluster.registerVirtualMachine(node.id, vm);

    /* @When attempting to register another virtualMachine with the same id */
    /* @Then VirtualMachineIdAlreadyExists should be thrown */
    assertThrows(
      () => cluster.registerVirtualMachine(node.id, virtualMachine(100, "10.0.0.101")),
      VirtualMachineAlreadyExists,
    );
  });

  it("should throw VirtualMachineAddressAlreadyExists for duplicate address", () => {
    /* @Given a cluster with a node that already has a virtualMachine with address 10.0.0.100 */
    const cluster = register();
    const node = registerNode("node-1", "192.168.1.1");
    cluster.registerNode(node);
    cluster.assignImage(node.id, nodeImage());
    cluster.registerVirtualMachine(node.id, virtualMachine(100, "10.0.0.100"));

    /* @When attempting to register another virtualMachine with the same address */
    /* @Then VirtualMachineAddressAlreadyExists should be thrown */
    assertThrows(
      () => cluster.registerVirtualMachine(node.id, virtualMachine(101, "10.0.0.100")),
      VirtualMachineAlreadyExists,
    );
  });
});

describe("Cluster — VM mutations are locked while the node is in-flight", () => {
  const provisioningCluster = () => {
    const cluster = register();
    const node = registerNode("node-1", "192.168.1.1");
    cluster.registerNode(node);
    cluster.assignImage(node.id, nodeImage());
    cluster.registerVirtualMachine(node.id, virtualMachine(100, "10.0.0.100"));
    // REGISTERED → PLAN_STARTED → PLAN_SUCCEEDED → APPLY_STARTED
    cluster.startPlan(node.id);
    cluster.completePlan(node.id);
    cluster.startApply(node.id);
    return { cluster, node };
  };

  it("rejects register/replace/unregister/unregisterAll on a APPLY_STARTED node", () => {
    const { cluster, node } = provisioningCluster();

    assertThrows(
      () => cluster.replaceVirtualMachine(node.id, virtualMachine(100, "10.0.0.100")),
      NodeBusy,
    );
    assertThrows(
      () => cluster.registerVirtualMachine(node.id, virtualMachine(101, "10.0.0.101")),
      NodeBusy,
    );
    assertThrows(
      () => cluster.unregisterVirtualMachine(node.id, new VirtualMachineId(100)),
      NodeBusy,
    );
    assertThrows(() => cluster.unregisterAllVirtualMachines(node.id), NodeBusy);
  });

  it("allows VM mutation again once the node leaves the in-flight state", () => {
    const { cluster, node } = provisioningCluster();
    cluster.completeApply(node.id); // APPLY_STARTED → APPLY_SUCCEEDED

    cluster.replaceVirtualMachine(node.id, virtualMachine(100, "10.0.0.101"));

    assertEquals(cluster.nodes.items[0].virtualMachines.length, 1);
  });

  it("does NOT block VM mutation during PLAN (compose-then-replan stays free)", () => {
    const cluster = register();
    const node = registerNode("node-1", "192.168.1.1");
    cluster.registerNode(node);
    cluster.assignImage(node.id, nodeImage());
    cluster.startPlan(node.id); // REGISTERED → PLAN_STARTED

    cluster.registerVirtualMachine(node.id, virtualMachine(100, "10.0.0.100"));

    assertEquals(cluster.nodes.items[0].virtualMachines.length, 1);
  });
});

describe("Cluster.replaceVirtualMachine", () => {
  it("should update virtualMachine data and bump version", () => {
    /* @Given a cluster with one node with one virtualMachine */
    const cluster = register();
    const node = registerNode("node-1", "192.168.1.1");
    cluster.registerNode(node);
    cluster.assignImage(node.id, nodeImage());
    const vm = virtualMachine(100, "10.0.0.100");
    cluster.registerVirtualMachine(node.id, vm);

    /* @When the virtualMachine is updated with new data */
    cluster.replaceVirtualMachine(node.id, virtualMachine(100, "10.0.0.101"));

    /* @Then the virtualMachine should reflect the new data and the version should be incremented */
    const host = cluster.nodes.items[0];
    assertEquals(host.virtualMachines.items[0].id.value, vm.id.value);
    assertEquals(cluster.version.value, 5);
  });

  it("should throw VirtualMachineNotFound for unknown virtualMachine id", () => {
    /* @Given a cluster with one node without virtualMachines */
    const cluster = register();
    const node = registerNode("node-1", "192.168.1.1");
    cluster.registerNode(node);

    /* @When attempting to update a nonexistent virtualMachine */
    /* @Then VirtualMachineNotFound should be thrown */
    assertThrows(
      () => cluster.replaceVirtualMachine(node.id, virtualMachine()),
      VirtualMachineNotFound,
    );
  });
});

describe("Cluster.unregisterVirtualMachine", () => {
  it("should remove the virtualMachine and bump version", () => {
    /* @Given a cluster with one node with one virtualMachine */
    const cluster = register();
    const node = registerNode("node-1", "192.168.1.1");
    cluster.registerNode(node);
    cluster.assignImage(node.id, nodeImage());
    const vm = virtualMachine(100, "10.0.0.100");
    cluster.registerVirtualMachine(node.id, vm);

    /* @When the virtualMachine is removed */
    cluster.unregisterVirtualMachine(node.id, vm.id);

    /* @Then the node should become empty and the version should be incremented */
    assertEquals(cluster.nodes.items[0].virtualMachines.length, 0);
    assertEquals(cluster.version.value, 5);
  });

  it("should throw VirtualMachineNotFound for unknown virtualMachine id", () => {
    /* @Given a cluster with a node without the target virtualMachine */
    const cluster = register();
    const node = registerNode("node-1", "192.168.1.1");
    cluster.registerNode(node);

    /* @When attempting to remove a nonexistent virtualMachine */
    /* @Then VirtualMachineNotFound should be thrown */
    assertThrows(
      () => cluster.unregisterVirtualMachine(node.id, new VirtualMachineId(9999)),
      VirtualMachineNotFound,
    );
  });
});

describe("Cluster.unregisterVirtualMachines", () => {
  it("should clear all virtualMachines from the node and bump version", () => {
    /* @Given a cluster with one node with two virtualMachines */
    const cluster = register();
    const node = registerNode("node-1", "192.168.1.1");
    cluster.registerNode(node);
    cluster.assignImage(node.id, nodeImage());
    cluster.registerVirtualMachine(node.id, virtualMachine(100, "10.0.0.100"));
    cluster.registerVirtualMachine(node.id, virtualMachine(101, "10.0.0.101"));

    /* @When all virtualMachines are removed */
    cluster.unregisterAllVirtualMachines(node.id);

    /* @Then the node should become empty and the version should be incremented */
    assertEquals(cluster.nodes.items[0].virtualMachines.length, 0);
    assertEquals(cluster.version.value, 6);
  });

  it("should throw NodeNotFound for unknown node id", () => {
    /* @Given a cluster without the target node */
    const cluster = register();

    /* @When attempting to clear virtualMachines from a nonexistent node */
    /* @Then NodeNotFound should be thrown */
    assertThrows(
      () => cluster.unregisterAllVirtualMachines(new NodeId()),
      NodeNotFound,
    );
  });
});

describe("ProxmoxCluster.connect", () => {
  it("should set connection and bump version", () => {
    /* @Given a cluster without a connection */
    const cluster = register();
    const initialVersion = cluster.version.value;
    assertEquals(cluster.connection, undefined);

    /* @When the connection is updated */
    cluster.connect(connection());

    /* @Then the cluster should have the connection and the version should be incremented */
    assertEquals(cluster.connection?.host.value, "192.168.1.1");
    assertEquals(cluster.connection?.vault.value, "vault-1");
    assertEquals(cluster.connection?.secret.value, "secret-1");
    assertEquals(cluster.version.value, initialVersion + 1);
  });

  it("should replace existing connection when updated", () => {
    /* @Given a cluster with an existing connection */
    const cluster = register();
    cluster.connect(connection());

    /* @When the connection is updated with new values */
    cluster.connect(connection("10.0.0.2", "v2", "s2"));

    /* @Then the cluster should reflect the new values */
    assertEquals(cluster.connection?.host.value, "10.0.0.2");
    assertEquals(cluster.connection?.vault.value, "v2");
    assertEquals(cluster.connection?.secret.value, "s2");
  });

  it("should not affect connection when removing a node", () => {
    /* @Given a cluster with a connection and a node */
    const cluster = register();
    const node = registerNode("pve1", "192.168.1.1");
    cluster.registerNode(node);
    cluster.connect(connection());

    /* @When the node is removed */
    cluster.unregisterNode(node.id);

    /* @Then the connection should remain intact */
    assertEquals(cluster.connection?.host.value, "192.168.1.1");
    assertEquals(cluster.nodes.items.length, 0);
  });
});

describe("ProxmoxCluster.disconnect", () => {
  it("should clear connection and bump version", () => {
    /* @Given a cluster with a connection */
    const cluster = register();
    cluster.connect(connection());
    const initialVersion = cluster.version.value;

    /* @When the connection is cleared */
    cluster.disconnect();

    /* @Then the cluster should no longer have a connection */
    assertEquals(cluster.connection, undefined);
    assertEquals(cluster.version.value, initialVersion + 1);
  });

  it("should be idempotent when clearing without connection", () => {
    /* @Given a cluster without a connection */
    const cluster = register();

    /* @When the connection is cleared */
    cluster.disconnect();

    /* @Then the cluster remains without a connection */
    assertEquals(cluster.connection, undefined);
  });

  it("should allow reconnecting after clear", () => {
    /* @Given a cluster that was connected and disconnected */
    const cluster = register();
    cluster.connect(connection());
    cluster.disconnect();

    /* @When a new connection is added */
    cluster.connect(connection("10.0.0.2", "v2", "s2"));

    /* @Then the cluster should have the new connection */
    assertEquals(cluster.connection?.host.value, "10.0.0.2");
  });
});

describe("ProxmoxCluster — node lifecycle transitions", () => {
  it("startPlan bumps version, transitions the node, and pushes NodePlanStarted", () => {
    /* @Given a cluster with one REGISTERED node */
    const cluster = register("homelab");
    const node = registerNode();
    cluster.registerNode(node);
    cluster.events.pull(); // drain registration event
    const versionAfterRegister = cluster.version.value;

    /* @When startPlan is called for the node */
    cluster.startPlan(node.id);

    /* @Then the node moves to PLAN_STARTED, the aggregate bumps, and one
       NodePlanStarted is on the events bag */
    assertEquals(cluster.nodes.of(node.id).state, State.PLAN_STARTED);
    assertEquals(cluster.version.value, versionAfterRegister + 1);
    const events = cluster.events.pull();
    assertEquals(events.length, 1);
    assertEquals(events[0].constructor.name, "NodePlanStarted");
  });

  it("accumulates one event per transition on the aggregate's bag", () => {
    /* @Given a cluster with one node going through plan → provisioning */
    const cluster = register("homelab");
    const node = registerNode();
    cluster.registerNode(node);
    cluster.events.pull();

    /* @When several transitions run */
    cluster.startPlan(node.id);
    cluster.completePlan(node.id);
    cluster.startApply(node.id);
    cluster.completeApply(node.id);

    /* @Then four events accumulate in order */
    const names = cluster.events.pull().map((e) => e.constructor.name);
    assertEquals(names, [
      "NodePlanStarted",
      "NodePlanSucceeded",
      "NodeApplyStarted",
      "NodeApplySucceeded",
    ]);
  });

  it("does not mutate other nodes when transitioning one", () => {
    /* @Given a cluster with two nodes */
    const cluster = register("homelab");
    const a = registerNode("a", "10.0.0.10");
    const b = registerNode("b", "10.0.0.11");
    cluster.registerNode(a);
    cluster.registerNode(b);

    /* @When only node a transitions */
    cluster.startPlan(a.id);

    /* @Then node b stays REGISTERED */
    assertEquals(cluster.nodes.of(b.id).state, State.REGISTERED);
  });

  it("propagates InvalidNodeStateTransition when the underlying transition is illegal", () => {
    /* @Given a cluster with a REGISTERED node */
    const cluster = register("homelab");
    const node = registerNode();
    cluster.registerNode(node);

    /* @When startApply is attempted from REGISTERED */
    /* @Then the transition is rejected */
    assertThrows(
      () => cluster.startApply(node.id),
      InvalidNodeStateTransition,
    );
  });

  it("throws NodeNotFound when transitioning an unknown node", () => {
    /* @Given a cluster without the target node */
    const cluster = register("homelab");

    /* @When startPlan is called with an unknown id */
    /* @Then NodeNotFound bubbles up from Nodes.of */
    assertThrows(
      () => cluster.startPlan(new NodeId()),
      NodeNotFound,
    );
  });
});

/**
 * Operator-acknowledged transition out of a transient state via the
 * existing `fail*()` edges. No new ALLOWED transitions; just a switch
 * over the current state.
 */
describe("Cluster.acknowledgeInterruption", () => {
  const inPlanStarted = () => {
    const cluster = register();
    const node = registerNode("n", "10.0.0.1");
    cluster.registerNode(node);
    cluster.startPlan(node.id);
    return { cluster, node };
  };
  const inProvisioningStarted = () => {
    const cluster = register();
    const node = registerNode("n", "10.0.0.1");
    cluster.registerNode(node);
    cluster.startPlan(node.id);
    cluster.completePlan(node.id);
    cluster.startApply(node.id);
    return { cluster, node };
  };
  const inDestroying = () => {
    const cluster = register();
    const node = registerNode("n", "10.0.0.1");
    cluster.registerNode(node);
    cluster.startPlan(node.id);
    cluster.completePlan(node.id);
    cluster.startApply(node.id);
    cluster.completeApply(node.id);
    cluster.startDestroy(node.id);
    return { cluster, node };
  };

  it("transitions PLAN_STARTED to PLAN_FAILED when the operator acknowledges", () => {
    /* @Given a node interrupted while PLAN_STARTED */
    const { cluster, node } = inPlanStarted();
    /* @When the operator acknowledges the interruption */
    cluster.acknowledgeInterruption(node.id);
    /* @Then the node demotes to PLAN_FAILED (existing retry edge applies) */
    assertEquals(cluster.nodes.of(node.id).state, State.PLAN_FAILED);
  });

  it("transitions APPLY_STARTED to APPLY_FAILED when acknowledged", () => {
    /* @Given a node interrupted while APPLY_STARTED */
    const { cluster, node } = inProvisioningStarted();
    /* @When acknowledge is called */
    cluster.acknowledgeInterruption(node.id);
    /* @Then the node demotes to APPLY_FAILED */
    assertEquals(cluster.nodes.of(node.id).state, State.APPLY_FAILED);
  });

  it("transitions DESTROY_STARTED to DESTROY_FAILED when acknowledged", () => {
    /* @Given a node interrupted while DESTROY_STARTED */
    const { cluster, node } = inDestroying();
    /* @When acknowledge is called */
    cluster.acknowledgeInterruption(node.id);
    /* @Then the node demotes to DESTROY_FAILED (retry edge restored) */
    assertEquals(cluster.nodes.of(node.id).state, State.DESTROY_FAILED);
  });

  it("rejects acknowledge on a non-transient state (healthy node)", () => {
    /* @Given a node in REGISTERED (initial state) */
    const cluster = register();
    const node = registerNode("n", "10.0.0.1");
    cluster.registerNode(node);
    /* @When acknowledge is called */
    /* @Then NodeNotInterrupted is raised so healthy nodes cannot be marked failed by mistake */
    assertThrows(
      () => cluster.acknowledgeInterruption(node.id),
      NodeNotInterrupted,
      "REGISTERED",
    );

    /* @Given the node is APPLY_SUCCEEDED (healthy after a successful apply) */
    cluster.startPlan(node.id);
    cluster.completePlan(node.id);
    cluster.startApply(node.id);
    cluster.completeApply(node.id);
    /* @When acknowledge is called */
    /* @Then NodeNotInterrupted is also raised */
    assertThrows(
      () => cluster.acknowledgeInterruption(node.id),
      NodeNotInterrupted,
      "APPLY_SUCCEEDED",
    );
  });

  it("emits the same Node*Failed event as the corresponding fail*() (uniform listener path)", () => {
    /* @Given a node in APPLY_STARTED */
    const { cluster, node } = inProvisioningStarted();
    cluster.events.pull(); // drain setup events
    /* @When acknowledge is called */
    cluster.acknowledgeInterruption(node.id);
    /* @Then exactly one NodeApplyFailed event is emitted */
    /*       (so the UI/audit pipeline sees the failure the same way as a real provisioning error) */
    const events = cluster.events.pull();
    assertEquals(events.length, 1);
    assertEquals(events[0].constructor.name, "NodeApplyFailed");
  });
});

describe("ProxmoxCluster — image assignment events", () => {
  it("assignImage emits ImageAssignedToNode carrying cluster + node display names", () => {
    /* @Given a cluster with a node */
    const cluster = register();
    const node = registerNode("cp4", "192.168.1.1");
    cluster.registerNode(node);
    /* @When an image is assigned */
    cluster.assignImage(node.id, nodeImage());
    /* @Then exactly one ImageAssignedToNode is queued with names for the images projection */
    const events = cluster.events.pull();
    assertEquals(events.length, 1);
    const event = events[0] as ImageAssignedToNode;
    assert(event instanceof ImageAssignedToNode);
    assertEquals(event.clusterName.value, cluster.name.value);
    assertEquals(event.nodeName.value, "cp4");
    assertEquals(event.nodeId.value, node.id.value);
  });

  it("unassignImage emits ImageUnassignedFromNode for the projection to drop", () => {
    /* @Given a node with an image assigned */
    const cluster = register();
    const node = registerNode("cp4", "192.168.1.1");
    cluster.registerNode(node);
    cluster.assignImage(node.id, nodeImage());
    cluster.events.pull(); // drain the assign event
    /* @When the image is unassigned */
    cluster.unassignImage(node.id, { value: nodeImage().imageId.value });
    /* @Then one ImageUnassignedFromNode is queued */
    const events = cluster.events.pull();
    assertEquals(events.length, 1);
    assert(events[0] instanceof ImageUnassignedFromNode);
    assertEquals((events[0] as ImageUnassignedFromNode).nodeId.value, node.id.value);
  });
});
