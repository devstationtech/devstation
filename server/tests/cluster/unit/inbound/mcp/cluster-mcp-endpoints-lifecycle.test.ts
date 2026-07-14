import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { McpPolicy } from "@server/shared/inbound/mcp/policy/mcp-policy.ts";
import { PolicyViolation } from "@server/shared/inbound/mcp/policy/violation.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

import { RegisterClusterMcpEndpoint } from "@server/cluster/inbound/mcp/register/endpoint.ts";
import { UnregisterClusterMcpEndpoint } from "@server/cluster/inbound/mcp/unregister/endpoint.ts";
import { ConnectClusterMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/connect/endpoint.ts";
import { DisconnectClusterMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/disconnect/endpoint.ts";
import { UpdateNodeMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/nodes/update/endpoint.ts";
import { UnregisterNodeMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/nodes/unregister/endpoint.ts";
import { UnregisterAllNodesMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/nodes/unregister-all/endpoint.ts";

import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import type { RegisterClusterHandler } from "@server/cluster/application/handlers/proxmox/register-cluster-handler.ts";
import type { UnregisterClusterHandler } from "@server/cluster/application/handlers/proxmox/unregister-cluster-handler.ts";
import type { ConnectClusterHandler } from "@server/cluster/application/handlers/proxmox/connect-cluster-handler.ts";
import type { DisconnectClusterHandler } from "@server/cluster/application/handlers/proxmox/disconnect-cluster-handler.ts";
import type { UpdateNodeHandler } from "@server/cluster/application/handlers/proxmox/update-node-handler.ts";
import type { UnregisterNodeHandler } from "@server/cluster/application/handlers/proxmox/unregister-node-handler.ts";
import type { UnregisterAllNodesHandler } from "@server/cluster/application/handlers/proxmox/unregister-all-nodes-handler.ts";

import type { RegisterCluster } from "@server/cluster/application/commands/proxmox/register-cluster.ts";
import type { UnregisterCluster } from "@server/cluster/application/commands/proxmox/unregister-cluster.ts";
import type { ConnectCluster } from "@server/cluster/application/commands/proxmox/connect-cluster.ts";
import type { DisconnectCluster } from "@server/cluster/application/commands/proxmox/disconnect-cluster.ts";
import type { UpdateNode } from "@server/cluster/application/commands/proxmox/update-node.ts";
import type { UnregisterNode } from "@server/cluster/application/commands/proxmox/unregister-node.ts";
import type { UnregisterAllNodes } from "@server/cluster/application/commands/proxmox/unregister-all-nodes.ts";

/**
 * Pins lifecycle + node + image cluster MCP endpoints:
 *
 *  - RegisterClusterMcpEndpoint (mutating, policy via new cluster name in args)
 *  - UnregisterClusterMcpEndpoint (destructive, policy via resolved cluster name)
 *  - ConnectClusterMcpEndpoint (mutating, policy via resolved cluster name)
 *  - DisconnectClusterMcpEndpoint (mutating, policy via resolved cluster name)
 *  - UpdateNodeMcpEndpoint (mutating, policy via resolved cluster name)
 *  - UnregisterNodeMcpEndpoint (destructive, policy via resolved cluster name)
 *  - UnregisterAllNodesMcpEndpoint (destructive, policy via resolved cluster name)
 *
 * For each endpoint the tests verify:
 *  1. Wire metadata (name + risk tier).
 *  2. Policy refusal: PolicyViolation raised + handler never called.
 *  3. Policy pass-through (OFF): handler called with the right command fields.
 */

// deno-lint-ignore no-explicit-any
type Anyish = any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeClusterByIdQuery(record: { name: string } | null): ClusterByIdQuery {
  return { execute: () => Promise.resolve(record) } as Anyish;
}

function fakeVoidHandler<T>(): { handler: T; calls: Anyish[] } {
  const calls: Anyish[] = [];
  const handler = {
    handle(cmd: Anyish): Promise<Anyish> {
      calls.push(cmd);
      // Resolves to an object that has the fields any of our handlers
      // might destructure. Universal-cast keeps the fake compatible
      // with both void-returning and id-returning shapes.
      return Promise.resolve({ clusterId: "c-fake-1" });
    },
  } as Anyish as T;
  return { handler, calls };
}

const PREFIX_POLICY = McpPolicy.load("prefix:ds-e2e-");
const OFF_POLICY = McpPolicy.OFF;

// ---------------------------------------------------------------------------
// 1. RegisterClusterMcpEndpoint
// ---------------------------------------------------------------------------

describe("RegisterClusterMcpEndpoint (mutating — policy via args.name)", () => {
  it("declares wire metadata", () => {
    /* @Given the register-cluster endpoint */
    const { handler } = fakeVoidHandler<RegisterClusterHandler>();
    const ep = new RegisterClusterMcpEndpoint(handler);
    /* @Then it advertises its name, mutating risk tier and object schema */
    assertEquals(ep.name, "devstation_cluster_register");
    assertEquals(ep.risk, "mutating");
    assertEquals(ep.inputSchema.type, "object");
  });

  it("refuses when the new cluster name lacks the policy prefix", async () => {
    /* @Given the endpoint under a prefix policy */
    const { handler, calls } = fakeVoidHandler<RegisterClusterHandler>();
    const ep = new RegisterClusterMcpEndpoint(handler);
    /* @When dispatched with a name that lacks the prefix */
    /* @Then it raises PolicyViolation and never calls the handler */
    await assertRejects(
      () =>
        ep.dispatch(
          { name: "prod-cluster", user: "alice", hostname: "10.0.0.1" },
          { policy: PREFIX_POLICY },
        ),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("registers the cluster when the name carries the prefix (OFF policy)", async () => {
    /* @Given the endpoint with policy OFF */
    const { handler, calls } = fakeVoidHandler<RegisterClusterHandler>();
    const ep = new RegisterClusterMcpEndpoint(handler);
    /* @When dispatched with a prefixed name and full args */
    const result = await ep.dispatch(
      { name: "ds-e2e-lab", user: "alice", hostname: "10.0.0.1" },
      { policy: OFF_POLICY },
    );
    /* @Then the handler is called once with the mapped command and the new id is returned */
    assertEquals(calls.length, 1);
    assertEquals((calls[0] as RegisterCluster).name, "ds-e2e-lab");
    assertEquals((calls[0] as RegisterCluster).user, "alice");
    assertEquals((calls[0] as RegisterCluster).host, "10.0.0.1");
    // register returns the new id so the caller can chain into
    // cluster_connect without an extra cluster_list round-trip.
    assertEquals(result, { clusterId: "c-fake-1", name: "ds-e2e-lab" });
  });

  // Both `user`/`hostname` args are optional; the endpoint resolves
  // them from the engine's $USER/$USERNAME + Deno.hostname() so the
  // audit trail captures the real operator instead of a placeholder.
  it("auto-derives user/hostname from the engine env when args omit them", async () => {
    /* @Given the endpoint and an engine env with USER set */
    const { handler, calls } = fakeVoidHandler<RegisterClusterHandler>();
    const ep = new RegisterClusterMcpEndpoint(handler);

    /* @When dispatched without user/hostname args */
    const ogUser = Deno.env.get("USER");
    const ogUsername = Deno.env.get("USERNAME");
    Deno.env.set("USER", "qa-runner");
    Deno.env.delete("USERNAME");
    try {
      await ep.dispatch({ name: "ds-cluster" }, { policy: OFF_POLICY });
    } finally {
      if (ogUser === undefined) Deno.env.delete("USER");
      else Deno.env.set("USER", ogUser);
      if (ogUsername !== undefined) Deno.env.set("USERNAME", ogUsername);
    }

    /* @Then the command carries the resolved real operator, not "unknown" */
    assertEquals(calls.length, 1);
    const cmd = calls[0] as RegisterCluster;
    assertEquals(cmd.user, "qa-runner");
    // hostname is whatever Deno.hostname() returns on this box — just
    // confirm it isn't the broken "unknown" placeholder LLMs used to send.
    assertEquals(typeof cmd.host, "string");
    assertEquals(cmd.host.length > 0, true);
    assertEquals(cmd.host, cmd.host.trim());
  });

  // The schema must advertise user/hostname as optional so LLM clients
  // stop hallucinating "unknown" for them.
  it("declares user and hostname as optional in the schema", () => {
    /* @Given the register-cluster endpoint */
    const { handler } = fakeVoidHandler<RegisterClusterHandler>();
    const ep = new RegisterClusterMcpEndpoint(handler);
    /* @Then the schema marks user/hostname optional and name required */
    const required = (ep.inputSchema as { required: string[] }).required;
    assertEquals(required.includes("user"), false);
    assertEquals(required.includes("hostname"), false);
    assertEquals(required.includes("name"), true);
  });
});

// ---------------------------------------------------------------------------
// 2. UnregisterClusterMcpEndpoint
// ---------------------------------------------------------------------------

describe("UnregisterClusterMcpEndpoint (destructive)", () => {
  it("declares wire metadata", () => {
    /* @Given the unregister-cluster endpoint */
    const { handler } = fakeVoidHandler<UnregisterClusterHandler>();
    const ep = new UnregisterClusterMcpEndpoint(handler, fakeClusterByIdQuery(null));
    /* @Then it advertises its name and destructive risk tier */
    assertEquals(ep.name, "devstation_cluster_unregister");
    assertEquals(ep.risk, "destructive");
  });

  it("refuses an off-policy cluster BEFORE calling the handler", async () => {
    /* @Given a cluster whose resolved name fails the prefix policy */
    const { handler, calls } = fakeVoidHandler<UnregisterClusterHandler>();
    const ep = new UnregisterClusterMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "prod-cluster" }),
    );
    /* @When dispatched under the prefix policy */
    /* @Then it raises PolicyViolation before touching the handler */
    await assertRejects(
      () => ep.dispatch({ clusterId: "c1" }, { policy: PREFIX_POLICY }),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("throws ClusterNotFound (not a policy violation) when the cluster does not exist", async () => {
    /* @Given a policy that would reject, and a cluster id that resolves to nothing */
    const { handler, calls } = fakeVoidHandler<UnregisterClusterHandler>();
    const ep = new UnregisterClusterMcpEndpoint(handler, fakeClusterByIdQuery(null));
    /* @When dispatched against the missing cluster under the prefix policy */
    /* @Then the caller hears the plain not-found — a non-existent target is not a
       policy problem — and the handler is never reached */
    await assertRejects(
      () => ep.dispatch({ clusterId: "ghost" }, { policy: PREFIX_POLICY }),
      ClusterNotFound,
      "not found",
    );
    assertEquals(calls.length, 0);
  });

  it("unregisters the cluster with OFF policy", async () => {
    /* @Given the endpoint with policy OFF */
    const { handler, calls } = fakeVoidHandler<UnregisterClusterHandler>();
    const ep = new UnregisterClusterMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "any" }),
    );
    /* @When dispatched with a cluster id */
    const result = await ep.dispatch({ clusterId: "c1" }, { policy: OFF_POLICY });
    /* @Then the handler is called once with that id */
    assertEquals(calls.length, 1);
    assertEquals((calls[0] as UnregisterCluster).id, "c1");
    assertEquals(result, {});
  });
});

// ---------------------------------------------------------------------------
// 3. ConnectClusterMcpEndpoint
// ---------------------------------------------------------------------------

describe("ConnectClusterMcpEndpoint (mutating)", () => {
  const connectArgs = {
    clusterId: "c1",
    host: "10.0.0.5",
    vaultId: "v1",
    secretId: "s1",
    cloneStrategy: "linked",
    parallelism: 2,
  };

  it("declares wire metadata", () => {
    /* @Given the connect-cluster endpoint */
    const { handler } = fakeVoidHandler<ConnectClusterHandler>();
    const ep = new ConnectClusterMcpEndpoint(handler, fakeClusterByIdQuery(null));
    /* @Then it advertises its name and mutating risk tier */
    assertEquals(ep.name, "devstation_cluster_connect");
    assertEquals(ep.risk, "mutating");
  });

  it("refuses an off-policy cluster BEFORE calling the handler", async () => {
    /* @Given a cluster whose resolved name fails the prefix policy */
    const { handler, calls } = fakeVoidHandler<ConnectClusterHandler>();
    const ep = new ConnectClusterMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "prod-cluster" }),
    );
    /* @When dispatched under the prefix policy */
    /* @Then it raises PolicyViolation before touching the handler */
    await assertRejects(
      () => ep.dispatch(connectArgs, { policy: PREFIX_POLICY }),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("connects the cluster with OFF policy, passing all fields through", async () => {
    /* @Given the endpoint with policy OFF */
    const { handler, calls } = fakeVoidHandler<ConnectClusterHandler>();
    const ep = new ConnectClusterMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "homelab" }),
    );
    /* @When dispatched with the full connect args */
    const result = await ep.dispatch(connectArgs, { policy: OFF_POLICY });
    /* @Then the handler receives every connection field */
    assertEquals(calls.length, 1);
    assertEquals((calls[0] as ConnectCluster).clusterId, "c1");
    assertEquals((calls[0] as ConnectCluster).host, "10.0.0.5");
    assertEquals((calls[0] as ConnectCluster).vaultId, "v1");
    assertEquals((calls[0] as ConnectCluster).secretId, "s1");
    assertEquals((calls[0] as ConnectCluster).cloneStrategy, "linked");
    assertEquals((calls[0] as ConnectCluster).parallelism, 2);
    assertEquals(result, {});
  });
});

// ---------------------------------------------------------------------------
// 4. DisconnectClusterMcpEndpoint
// ---------------------------------------------------------------------------

describe("DisconnectClusterMcpEndpoint (mutating)", () => {
  it("declares wire metadata", () => {
    /* @Given the disconnect-cluster endpoint */
    const { handler } = fakeVoidHandler<DisconnectClusterHandler>();
    const ep = new DisconnectClusterMcpEndpoint(handler, fakeClusterByIdQuery(null));
    /* @Then it advertises its name and mutating risk tier */
    assertEquals(ep.name, "devstation_cluster_disconnect");
    assertEquals(ep.risk, "mutating");
  });

  it("refuses an off-policy cluster BEFORE calling the handler", async () => {
    /* @Given a cluster whose resolved name fails the prefix policy */
    const { handler, calls } = fakeVoidHandler<DisconnectClusterHandler>();
    const ep = new DisconnectClusterMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "prod-cluster" }),
    );
    /* @When dispatched under the prefix policy */
    /* @Then it raises PolicyViolation before touching the handler */
    await assertRejects(
      () => ep.dispatch({ clusterId: "c1" }, { policy: PREFIX_POLICY }),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("disconnects the cluster with OFF policy", async () => {
    /* @Given the endpoint with policy OFF */
    const { handler, calls } = fakeVoidHandler<DisconnectClusterHandler>();
    const ep = new DisconnectClusterMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "homelab" }),
    );
    /* @When dispatched with a cluster id */
    const result = await ep.dispatch({ clusterId: "c1" }, { policy: OFF_POLICY });
    /* @Then the handler is called once with that id */
    assertEquals(calls.length, 1);
    assertEquals((calls[0] as DisconnectCluster).clusterId, "c1");
    assertEquals(result, {});
  });
});

// ---------------------------------------------------------------------------
// 5. UpdateNodeMcpEndpoint
// ---------------------------------------------------------------------------

describe("UpdateNodeMcpEndpoint (mutating)", () => {
  const updateNodeArgs = {
    clusterId: "c1",
    nodeId: "n1",
    name: "cp1",
    ip: "192.168.15.10",
    vaultId: "v1",
    usernameSecretId: "u1",
    passwordSecretId: "p1",
  };

  it("declares wire metadata", () => {
    /* @Given the update-node endpoint */
    const { handler } = fakeVoidHandler<UpdateNodeHandler>();
    const ep = new UpdateNodeMcpEndpoint(handler, fakeClusterByIdQuery(null));
    /* @Then it advertises its name and mutating risk tier */
    assertEquals(ep.name, "devstation_cluster_node_update");
    assertEquals(ep.risk, "mutating");
  });

  it("refuses an off-policy cluster BEFORE calling the handler", async () => {
    /* @Given a cluster whose resolved name fails the prefix policy */
    const { handler, calls } = fakeVoidHandler<UpdateNodeHandler>();
    const ep = new UpdateNodeMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "prod-cluster" }),
    );
    /* @When dispatched under the prefix policy */
    /* @Then it raises PolicyViolation before touching the handler */
    await assertRejects(
      () => ep.dispatch(updateNodeArgs, { policy: PREFIX_POLICY }),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("updates the node with OFF policy, passing all fields through", async () => {
    /* @Given the endpoint with policy OFF */
    const { handler, calls } = fakeVoidHandler<UpdateNodeHandler>();
    const ep = new UpdateNodeMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "homelab" }),
    );
    /* @When dispatched with the full update-node args */
    const result = await ep.dispatch(updateNodeArgs, { policy: OFF_POLICY });
    /* @Then the handler receives every node field */
    assertEquals(calls.length, 1);
    assertEquals((calls[0] as UpdateNode).clusterId, "c1");
    assertEquals((calls[0] as UpdateNode).nodeId, "n1");
    assertEquals((calls[0] as UpdateNode).name, "cp1");
    assertEquals((calls[0] as UpdateNode).ip, "192.168.15.10");
    assertEquals((calls[0] as UpdateNode).vaultId, "v1");
    assertEquals((calls[0] as UpdateNode).usernameSecretId, "u1");
    assertEquals((calls[0] as UpdateNode).passwordSecretId, "p1");
    assertEquals(result, {});
  });
});

// ---------------------------------------------------------------------------
// 6. UnregisterNodeMcpEndpoint
// ---------------------------------------------------------------------------

describe("UnregisterNodeMcpEndpoint (destructive)", () => {
  it("declares wire metadata", () => {
    /* @Given the unregister-node endpoint */
    const { handler } = fakeVoidHandler<UnregisterNodeHandler>();
    const ep = new UnregisterNodeMcpEndpoint(handler, fakeClusterByIdQuery(null));
    /* @Then it advertises its name and destructive risk tier */
    assertEquals(ep.name, "devstation_cluster_node_unregister");
    assertEquals(ep.risk, "destructive");
  });

  it("refuses an off-policy cluster BEFORE calling the handler", async () => {
    /* @Given a cluster whose resolved name fails the prefix policy */
    const { handler, calls } = fakeVoidHandler<UnregisterNodeHandler>();
    const ep = new UnregisterNodeMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "prod-cluster" }),
    );
    /* @When dispatched under the prefix policy */
    /* @Then it raises PolicyViolation before touching the handler */
    await assertRejects(
      () => ep.dispatch({ clusterId: "c1", nodeId: "n1" }, { policy: PREFIX_POLICY }),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("unregisters the node with OFF policy", async () => {
    /* @Given the endpoint with policy OFF */
    const { handler, calls } = fakeVoidHandler<UnregisterNodeHandler>();
    const ep = new UnregisterNodeMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "homelab" }),
    );
    /* @When dispatched with cluster + node ids */
    const result = await ep.dispatch(
      { clusterId: "c1", nodeId: "n1" },
      { policy: OFF_POLICY },
    );
    /* @Then the handler is called once with both ids */
    assertEquals(calls.length, 1);
    assertEquals((calls[0] as UnregisterNode).clusterId, "c1");
    assertEquals((calls[0] as UnregisterNode).nodeId, "n1");
    assertEquals(result, {});
  });
});

// ---------------------------------------------------------------------------
// 7. UnregisterAllNodesMcpEndpoint
// ---------------------------------------------------------------------------

describe("UnregisterAllNodesMcpEndpoint (destructive)", () => {
  it("declares wire metadata", () => {
    /* @Given the unregister-all-nodes endpoint */
    const { handler } = fakeVoidHandler<UnregisterAllNodesHandler>();
    const ep = new UnregisterAllNodesMcpEndpoint(handler, fakeClusterByIdQuery(null));
    /* @Then it advertises its name and destructive risk tier */
    assertEquals(ep.name, "devstation_cluster_nodes_unregister_all");
    assertEquals(ep.risk, "destructive");
  });

  it("refuses an off-policy cluster BEFORE calling the handler", async () => {
    /* @Given a cluster whose resolved name fails the prefix policy */
    const { handler, calls } = fakeVoidHandler<UnregisterAllNodesHandler>();
    const ep = new UnregisterAllNodesMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "prod-cluster" }),
    );
    /* @When dispatched under the prefix policy */
    /* @Then it raises PolicyViolation before touching the handler */
    await assertRejects(
      () => ep.dispatch({ clusterId: "c1" }, { policy: PREFIX_POLICY }),
      PolicyViolation,
      "prefix",
    );
    assertEquals(calls.length, 0);
  });

  it("unregisters all nodes with OFF policy", async () => {
    /* @Given the endpoint with policy OFF */
    const { handler, calls } = fakeVoidHandler<UnregisterAllNodesHandler>();
    const ep = new UnregisterAllNodesMcpEndpoint(
      handler,
      fakeClusterByIdQuery({ name: "homelab" }),
    );
    /* @When dispatched with a cluster id */
    const result = await ep.dispatch({ clusterId: "c1" }, { policy: OFF_POLICY });
    /* @Then the handler is called once with that id */
    assertEquals(calls.length, 1);
    assertEquals((calls[0] as UnregisterAllNodes).clusterId, "c1");
    assertEquals(result, {});
  });
});
