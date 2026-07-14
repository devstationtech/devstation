import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ListClustersMcpEndpoint } from "@server/cluster/inbound/mcp/list/endpoint.ts";
import { ApplyNodesMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/provisioning/apply/endpoint.ts";
import { PlanNodesMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/provisioning/plan/endpoint.ts";
import { RegisterNodeMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/nodes/register/endpoint.ts";
import { RegisterVirtualMachineMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/virtual-machine/register/endpoint.ts";
import { McpPolicy } from "@server/shared/inbound/mcp/policy/mcp-policy.ts";
import { PolicyViolation } from "@server/shared/inbound/mcp/policy/violation.ts";
import type { Query as AllClustersQuery } from "@server/cluster/application/queries/all/query.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import type { ApplyNodesHandler } from "@server/cluster/application/handlers/proxmox/provisioning/apply-nodes-handler.ts";
import type { PlanNodesHandler } from "@server/cluster/application/handlers/proxmox/provisioning/plan-nodes-handler.ts";
import type { ApplyNodes } from "@server/cluster/application/commands/proxmox/provisioning/apply-nodes.ts";
import type { PlanNodes } from "@server/cluster/application/commands/proxmox/provisioning/plan-nodes.ts";
import type { Execution } from "@server/shared/executions/domain/models/execution.ts";
import type { RegisterNodeHandler } from "@server/cluster/application/handlers/proxmox/register-node-handler.ts";
import type { RegisterVirtualMachineHandler } from "@server/cluster/application/handlers/proxmox/register-virtual-machine-handler.ts";
import type { RegisterNode } from "@server/cluster/application/commands/proxmox/register-node.ts";
import type { RegisterVirtualMachine } from "@server/cluster/application/commands/proxmox/register-virtual-machine.ts";

/**
 * Pins the three representative shapes of the per-BC MCP endpoints for cluster:
 *
 *  1. Read endpoint (ListClustersMcpEndpoint) — delegates to the
 *     application Query directly (no gateway / no JSON-RPC).
 *  2. Mutating long-running endpoint with policy guard (ApplyNodes
 *     McpEndpoint) — resolves the cluster name via ClusterByIdQuery
 *     and calls `policy.requireMutableCluster` BEFORE handing the
 *     command to the application Handler. Off-policy clusters are
 *     refused with `PolicyViolation`.
 *  3. Non-mutating long-running endpoint (PlanNodesMcpEndpoint) — no
 *     policy consultation; calls handler unconditionally.
 *
 * The other 10 cluster MCP endpoints follow one of these three
 * shapes; F3 BCs (vault, size, blueprint, station) will reuse
 * the same patterns.
 */

// deno-lint-ignore no-explicit-any
type Anyish = any;

function fakeAllClustersQuery(records: unknown[]): AllClustersQuery {
  return { execute: () => Promise.resolve(records) } as Anyish;
}

function fakeClusterByIdQuery(record: { name: string } | null): ClusterByIdQuery {
  return { execute: () => Promise.resolve(record) } as Anyish;
}

function fakeApplyHandler(): { handler: ApplyNodesHandler; calls: ApplyNodes[] } {
  const calls: ApplyNodes[] = [];
  const handler = {
    handle(cmd: ApplyNodes): Promise<Execution> {
      calls.push(cmd);
      return Promise.resolve({ id: "exec-1" } as Execution);
    },
  } as Anyish as ApplyNodesHandler;
  return { handler, calls };
}

function fakePlanHandler(): { handler: PlanNodesHandler; calls: PlanNodes[] } {
  const calls: PlanNodes[] = [];
  const handler = {
    handle(cmd: PlanNodes): Promise<Execution> {
      calls.push(cmd);
      return Promise.resolve({ id: "exec-plan" } as Execution);
    },
  } as Anyish as PlanNodesHandler;
  return { handler, calls };
}

describe("ListClustersMcpEndpoint", () => {
  it("returns the records the AllClustersQuery yields (no gateway)", async () => {
    /* @Given a fake query that yields two records */
    const endpoint = new ListClustersMcpEndpoint(fakeAllClustersQuery([
      { id: "c1", name: "homelab" },
      { id: "c2", name: "prod" },
    ]));

    /* @When dispatch runs */
    const result = await endpoint.dispatch();

    /* @Then the query records pass through unchanged */
    assertEquals(result, [
      { id: "c1", name: "homelab" },
      { id: "c2", name: "prod" },
    ]);
  });

  it("declares the wire metadata MCP clients need (name + risk + schema)", () => {
    /* @Given a no-op endpoint */
    const endpoint = new ListClustersMcpEndpoint(fakeAllClustersQuery([]));
    /* @Then it advertises read + the expected wire name */
    assertEquals(endpoint.name, "devstation_cluster_list");
    assertEquals(endpoint.risk, "read");
    assertEquals(endpoint.inputSchema.type, "object");
  });
});

describe("ApplyNodesMcpEndpoint (long-running + policy guard)", () => {
  it("calls policy.requireMutableCluster on the resolved cluster name BEFORE the handler", async () => {
    /* @Given a policy with a prefix, a cluster whose name does NOT carry it */
    const { handler, calls } = fakeApplyHandler();
    const endpoint = new ApplyNodesMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "prod-cluster" }),
    );
    const policy = McpPolicy.load("prefix:ds-e2e-");

    /* @When dispatch runs */
    /* @Then PolicyViolation — and the handler must NOT have been called */
    await assertRejects(
      () =>
        endpoint.dispatch(
          { clusterId: "c1", nodeIds: ["n1"] },
          { policy },
        ),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("allows dispatch when the cluster name carries the policy prefix; returns executionId", async () => {
    /* @Given an allowed cluster name (carries the prefix) */
    const { handler, calls } = fakeApplyHandler();
    const endpoint = new ApplyNodesMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "ds-e2e-lab" }),
    );
    const policy = McpPolicy.load("prefix:ds-e2e-");

    /* @When dispatch runs */
    const result = await endpoint.dispatch(
      { clusterId: "c1", nodeIds: ["n1", "n2"] },
      { policy },
    );

    /* @Then the handler ran once with the correct command */
    assertEquals(calls.length, 1);
    assertEquals(calls[0].clusterId, "c1");
    assertEquals([...calls[0].nodeIds], ["n1", "n2"]);
    /* @And the response is the execution handle, ready for execution_watch */
    assertEquals(result, { executionId: "exec-1" });
  });

  it("is a no-op for an OFF policy (full feature exposure default)", async () => {
    /* @Given policy OFF (production default) */
    const { handler, calls } = fakeApplyHandler();
    const endpoint = new ApplyNodesMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "anything" }),
    );

    /* @When dispatch runs */
    const result = await endpoint.dispatch(
      { clusterId: "c1", nodeIds: ["n1"] },
      { policy: McpPolicy.OFF },
    );

    /* @Then the handler ran and the result came through unchanged */
    assertEquals(calls.length, 1);
    assertEquals(result, { executionId: "exec-1" });
  });
});

describe("PlanNodesMcpEndpoint (long-running + policy guard)", () => {
  // Plan persists node FSM transitions (PLAN_STARTED → terminal) even though
  // it never touches infrastructure — so it is guarded exactly like
  // apply/destroy. The old "non-mutating, not subject to policy" behavior
  // let a read-only-policy agent mutate cluster state.
  it("calls policy.requireMutableCluster on the resolved cluster name BEFORE the handler", async () => {
    /* @Given a policy with a prefix, a cluster whose name does NOT carry it */
    const { handler, calls } = fakePlanHandler();
    const endpoint = new PlanNodesMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "prod-cluster" }),
    );
    const policy = McpPolicy.load("prefix:ds-e2e-");

    /* @When dispatch runs */
    /* @Then PolicyViolation — and the handler must NOT have been called */
    await assertRejects(
      () =>
        endpoint.dispatch(
          { clusterId: "c1", nodeIds: ["n1"] },
          { policy },
        ),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("allows dispatch when the cluster name carries the policy prefix; returns executionId", async () => {
    /* @Given an allowed cluster name (carries the prefix) */
    const { handler, calls } = fakePlanHandler();
    const endpoint = new PlanNodesMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "ds-e2e-lab" }),
    );
    const policy = McpPolicy.load("prefix:ds-e2e-");

    /* @When dispatch runs */
    const result = await endpoint.dispatch(
      { clusterId: "c1", nodeIds: ["n1"] },
      { policy },
    );

    /* @Then the handler ran and the execution handle came back */
    assertEquals(calls.length, 1);
    assertEquals(result, { executionId: "exec-plan" });
  });
});

function fakeRegisterNodeHandler(): { handler: RegisterNodeHandler; calls: RegisterNode[] } {
  const calls: RegisterNode[] = [];
  const handler = {
    handle(cmd: RegisterNode): Promise<void> {
      calls.push(cmd);
      return Promise.resolve();
    },
  } as Anyish as RegisterNodeHandler;
  return { handler, calls };
}

function fakeRegisterVirtualMachineHandler(): {
  handler: RegisterVirtualMachineHandler;
  calls: RegisterVirtualMachine[];
} {
  const calls: RegisterVirtualMachine[] = [];
  const handler = {
    handle(cmd: RegisterVirtualMachine): Promise<void> {
      calls.push(cmd);
      return Promise.resolve();
    },
  } as Anyish as RegisterVirtualMachineHandler;
  return { handler, calls };
}

const nodeArgs = {
  clusterId: "c1",
  name: "cp1",
  ip: "192.168.15.191",
  vaultId: "v1",
  usernameSecretId: "u1",
  passwordSecretId: "p1",
};

const vmArgs = {
  clusterId: "c1",
  nodeId: "n1",
  name: "k3s-01",
  id: 4004,
  size: "def-medium",
  image: "img-ubuntu",
  ip: "192.168.15.210",
  gateway: "192.168.15.1",
  dns: "192.168.15.1",
  storage: "s1",
  cpu: 4,
  ram: 8192,
  disk: 20,
  credentialVaultId: "v1",
  usernameSecretId: "u1",
  passwordSecretId: "p1",
  tags: ["qa", "server"],
};

describe("RegisterNodeMcpEndpoint (mutating + policy guard)", () => {
  it("advertises the mutating wire metadata MCP clients need", () => {
    /* @Given the endpoint */
    const { handler } = fakeRegisterNodeHandler();
    const endpoint = new RegisterNodeMcpEndpoint(handler, fakeClusterByIdQuery(null));
    /* @Then it declares the wire name and the mutating risk tier */
    assertEquals(endpoint.name, "devstation_cluster_node_register");
    assertEquals(endpoint.risk, "mutating");
  });

  it("refuses an off-policy cluster BEFORE calling the handler", async () => {
    /* @Given a prefix policy and a cluster whose name lacks it */
    const { handler, calls } = fakeRegisterNodeHandler();
    const endpoint = new RegisterNodeMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "prod-cluster" }),
    );

    /* @When dispatch runs @Then PolicyViolation and the handler never ran */
    await assertRejects(
      () => endpoint.dispatch(nodeArgs, { policy: McpPolicy.load("prefix:ds-e2e-") }),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("registers the node with the OFF policy (production default)", async () => {
    /* @Given policy OFF */
    const { handler, calls } = fakeRegisterNodeHandler();
    const endpoint = new RegisterNodeMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "homelab" }),
    );

    /* @When dispatch runs */
    const result = await endpoint.dispatch(nodeArgs, { policy: McpPolicy.OFF });

    /* @Then the handler ran once with the command carrying the args */
    assertEquals(calls.length, 1);
    assertEquals(calls[0].clusterId, "c1");
    assertEquals(calls[0].name, "cp1");
    assertEquals(calls[0].ip, "192.168.15.191");
    assertEquals(result, {});
  });
});

describe("RegisterVirtualMachineMcpEndpoint (mutating + policy guard)", () => {
  it("advertises the mutating wire metadata MCP clients need", () => {
    /* @Given the endpoint */
    const { handler } = fakeRegisterVirtualMachineHandler();
    const endpoint = new RegisterVirtualMachineMcpEndpoint(handler, fakeClusterByIdQuery(null));
    /* @Then it declares the wire name and the mutating risk tier */
    assertEquals(endpoint.name, "devstation_cluster_virtual_machine_register");
    assertEquals(endpoint.risk, "mutating");
  });

  it("refuses an off-policy cluster BEFORE calling the handler", async () => {
    /* @Given a prefix policy and a cluster whose name lacks it */
    const { handler, calls } = fakeRegisterVirtualMachineHandler();
    const endpoint = new RegisterVirtualMachineMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "prod-cluster" }),
    );

    /* @When dispatch runs @Then PolicyViolation and the handler never ran */
    await assertRejects(
      () => endpoint.dispatch(vmArgs, { policy: McpPolicy.load("prefix:ds-e2e-") }),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("registers the VM with the OFF policy, passing every field through", async () => {
    /* @Given policy OFF */
    const { handler, calls } = fakeRegisterVirtualMachineHandler();
    const endpoint = new RegisterVirtualMachineMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "homelab" }),
    );

    /* @When dispatch runs */
    const result = await endpoint.dispatch(vmArgs, { policy: McpPolicy.OFF });

    /* @Then the handler ran once with the full command (id, network, tags) */
    assertEquals(calls.length, 1);
    assertEquals(calls[0].id, 4004);
    assertEquals(calls[0].nodeId, "n1");
    assertEquals(calls[0].ip, "192.168.15.210");
    assertEquals([...calls[0].tags], ["qa", "server"]);
    assertEquals(result, {});
  });
});
