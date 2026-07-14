import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type { Cluster } from "@server/cluster/domain/models/cluster.ts";
import { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import { Id } from "@server/cluster/domain/models/id.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import { Name } from "@server/cluster/domain/models/name.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { Credential } from "@server/shared/building-blocks/domain/models/value-objects/credential.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import { Node as ProxmoxNode } from "@server/cluster/domain/models/proxmox/nodes/node.ts";
import { Name as NodeName } from "@server/cluster/domain/models/proxmox/nodes/name.ts";
import { Ip } from "@server/cluster/domain/models/proxmox/nodes/ip.ts";
import { State } from "@server/cluster/domain/models/proxmox/nodes/state.ts";
import { Nodes as ProxmoxNodes } from "@server/cluster/domain/models/proxmox/nodes/nodes.ts";
import { NodeImages } from "@server/cluster/domain/models/proxmox/nodes/images/node-images.ts";
import { VirtualMachines } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/virtual-machines.ts";
import { PlanNodesHandler } from "@server/cluster/application/handlers/proxmox/provisioning/plan-nodes-handler.ts";
import { ApplyNodesHandler } from "@server/cluster/application/handlers/proxmox/provisioning/apply-nodes-handler.ts";
import { DestroyNodesHandler } from "@server/cluster/application/handlers/proxmox/provisioning/destroy-nodes-handler.ts";
import { PlanNodes } from "@server/cluster/application/commands/proxmox/provisioning/plan-nodes.ts";
import { ApplyNodes } from "@server/cluster/application/commands/proxmox/provisioning/apply-nodes.ts";
import { DestroyNodes } from "@server/cluster/application/commands/proxmox/provisioning/destroy-nodes.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";
import type { Provisioning } from "@server/cluster/domain/ports/outbound/executions/proxmox/provisioning/provisioning.ts";
import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";
import type { Task } from "@server/shared/executions/domain/models/task.ts";
import type { ExecutionEvent } from "@server/shared/executions/domain/events/event.ts";
import { emitFrom } from "@server/shared/executions/outbound/streaming/emit-from.ts";
import { InMemoryExecutions } from "@server/shared/executions/outbound/in-memory-executions.ts";
import { Succeeded } from "@jsonrpc-contracts-ts/executions.gen.ts";
import { Failed } from "@jsonrpc-contracts-ts/executions.gen.ts";
import { Log } from "@jsonrpc-contracts-ts/executions.gen.ts";

const CLUSTER_ID = "c1";
const NODE_ID = "00000000-0000-0000-0000-000000000001";

const credential = () =>
  new Credential(
    new Vault("00000000-0000-0000-0000-000000000001"),
    new Secret("00000000-0000-0000-0000-000000000002"),
    new Secret("00000000-0000-0000-0000-000000000003"),
  );

const makeCluster = (initialState: State = State.REGISTERED): ProxmoxCluster =>
  new ProxmoxCluster(
    new Id(CLUSTER_ID),
    new Name("homelab"),
    new Creation(
      new User("alice"),
      new Hostname("host"),
      Instant.fromString("2026-01-01T00:00:00.000Z"),
    ),
    new ProxmoxNodes([
      new ProxmoxNode(
        new NodeId(NODE_ID),
        new NodeName("n1"),
        new Ip("10.0.0.10"),
        credential(),
        new NodeImages(),
        new VirtualMachines(),
        initialState,
      ),
    ]),
  );

class ClustersStub implements Clusters {
  saved: ProxmoxCluster[] = [];
  constructor(private readonly cluster: ProxmoxCluster) {}
  of<T extends Cluster>(id: Id): Promise<T> {
    if (id.value !== this.cluster.id.value) throw new Error("not found");
    return Promise.resolve(this.cluster as unknown as T);
  }
  byName<T extends Cluster>(_name: Name): Promise<T | null> {
    throw new Error("unused");
  }
  all(): Promise<Cluster[]> {
    return Promise.resolve([this.cluster]);
  }
  add(): Promise<void> {
    throw new Error("unused");
  }
  async update<T extends Cluster>(
    id: Id,
    change: (cluster: T) => void | Promise<void>,
  ): Promise<T> {
    if (id.value !== this.cluster.id.value) throw new Error("not found");
    await change(this.cluster as unknown as T);
    this.saved.push(this.cluster);
    return this.cluster as unknown as T;
  }
  exists(): Promise<boolean> {
    throw new Error("unused");
  }
  remove(): Promise<void> {
    throw new Error("unused");
  }
}

class TestDispatcher implements Dispatcher {
  dispatched: DomainEvent[] = [];
  dispatch(events: readonly DomainEvent[]): Promise<void> {
    this.dispatched.push(...events);
    return Promise.resolve();
  }
}

class ProvisioningStub implements Provisioning {
  calls: string[] = [];
  constructor(private readonly failOn: "plan" | "apply" | "destroy" | null = null) {}

  plan(_c: ProxmoxCluster, _n: NodeId[]): Task {
    return { run: (_op, emitter) => emitFrom(this.runOp("plan", "planning..."), emitter) };
  }

  apply(_c: ProxmoxCluster, _n: NodeId[]): Task {
    return { run: (_op, emitter) => emitFrom(this.runOp("apply", "applying..."), emitter) };
  }

  destroy(_c: ProxmoxCluster, _n: NodeId[]): Task {
    return { run: (_op, emitter) => emitFrom(this.runOp("destroy", "destroying..."), emitter) };
  }

  private async *runOp(
    op: "plan" | "apply" | "destroy",
    message: string,
  ): AsyncIterable<ExecutionEvent> {
    this.calls.push(op);
    yield new Log(message);
    if (this.failOn === op) throw new Error(`${op} boom`);
  }
}

async function collect(
  executions: InMemoryExecutions,
  id: string,
): Promise<{ outputs: ExecutionEvent[]; done: boolean; error: string | null }> {
  const outputs: ExecutionEvent[] = [];
  let done = false;
  let error: string | null = null;
  for await (const output of executions.of(id).watch()) {
    outputs.push(output);
    if (output instanceof Succeeded) done = true;
    else if (output instanceof Failed) error = output.error;
  }
  return { outputs, done, error };
}

describe("PlanNodesHandler", () => {
  it("completes the execution, transitions node REGISTERED → PLAN_SUCCEEDED, dispatches lifecycle events", async () => {
    /* @Given a cluster with a REGISTERED node */
    const executions = new InMemoryExecutions();
    const provisioning = new ProvisioningStub();
    const clusters = new ClustersStub(makeCluster());
    const dispatcher = new TestDispatcher();
    const handler = new PlanNodesHandler(clusters, executions, provisioning, dispatcher);

    /* @When the handler is executed */
    const op = await handler.handle(new PlanNodes(CLUSTER_ID));

    /* @Then the run succeeds, provisioning.plan is invoked, node ends in PLAN_SUCCEEDED,
       both NodePlanStarted and NodePlanSucceeded are dispatched */
    const { outputs, done } = await collect(executions, op.id);
    assertEquals(done, true);
    assertEquals(provisioning.calls, ["plan"]);
    assertEquals(outputs.some((o) => o instanceof Log && o.line === "planning..."), true);
    const cluster = clusters.saved.at(-1)!;
    assertEquals(cluster.nodes.of(new NodeId(NODE_ID)).state, State.PLAN_SUCCEEDED);
    const dispatchedNames = dispatcher.dispatched.map((e) => e.constructor.name);
    assertEquals(dispatchedNames, ["NodePlanStarted", "NodePlanSucceeded"]);
  });

  it("fails the execution and transitions node to PLAN_FAILED when provisioning.plan throws", async () => {
    /* @Given a Provisioning that fails on plan */
    const executions = new InMemoryExecutions();
    const provisioning = new ProvisioningStub("plan");
    const clusters = new ClustersStub(makeCluster());
    const dispatcher = new TestDispatcher();
    const handler = new PlanNodesHandler(clusters, executions, provisioning, dispatcher);

    /* @When the handler is executed */
    const op = await handler.handle(new PlanNodes(CLUSTER_ID));

    /* @Then the execution fails, node ends in PLAN_FAILED, NodePlanFailed is dispatched */
    const { error } = await collect(executions, op.id);
    assertEquals(error, "plan boom");
    const cluster = clusters.saved.at(-1)!;
    assertEquals(cluster.nodes.of(new NodeId(NODE_ID)).state, State.PLAN_FAILED);
    const dispatchedNames = dispatcher.dispatched.map((e) => e.constructor.name);
    assertEquals(dispatchedNames, ["NodePlanStarted", "NodePlanFailed"]);
  });
});

describe("ApplyNodesHandler", () => {
  it("completes the execution, transitions PLAN_SUCCEEDED → APPLY_SUCCEEDED, dispatches lifecycle events", async () => {
    /* @Given a cluster with a node already in PLAN_SUCCEEDED */
    const executions = new InMemoryExecutions();
    const provisioning = new ProvisioningStub();
    const clusters = new ClustersStub(makeCluster(State.PLAN_SUCCEEDED));
    const dispatcher = new TestDispatcher();
    const handler = new ApplyNodesHandler(clusters, executions, provisioning, dispatcher);

    /* @When the handler is executed */
    const op = await handler.handle(new ApplyNodes(CLUSTER_ID));

    /* @Then run succeeds, provisioning.apply is called, node ends in APPLY_SUCCEEDED,
       NodeApplyStarted + NodeApplySucceeded are dispatched */
    const { done } = await collect(executions, op.id);
    assertEquals(done, true);
    assertEquals(provisioning.calls, ["apply"]);
    const cluster = clusters.saved.at(-1)!;
    assertEquals(cluster.nodes.of(new NodeId(NODE_ID)).state, State.APPLY_SUCCEEDED);
    const dispatchedNames = dispatcher.dispatched.map((e) => e.constructor.name);
    assertEquals(dispatchedNames, ["NodeApplyStarted", "NodeApplySucceeded"]);
  });
});

describe("DestroyNodesHandler", () => {
  it("completes the execution, transitions APPLY_SUCCEEDED → DESTROY_SUCCEEDED, dispatches lifecycle events", async () => {
    /* @Given a cluster with a node already in APPLY_SUCCEEDED */
    const executions = new InMemoryExecutions();
    const provisioning = new ProvisioningStub();
    const clusters = new ClustersStub(makeCluster(State.APPLY_SUCCEEDED));
    const dispatcher = new TestDispatcher();
    const handler = new DestroyNodesHandler(clusters, executions, provisioning, dispatcher);

    /* @When the handler is executed */
    const op = await handler.handle(new DestroyNodes(CLUSTER_ID));

    /* @Then run succeeds, provisioning.destroy is called, node ends in DESTROY_SUCCEEDED,
       NodeDestroyStarted + NodeDestroySucceeded are dispatched */
    const { done } = await collect(executions, op.id);
    assertEquals(done, true);
    assertEquals(provisioning.calls, ["destroy"]);
    const cluster = clusters.saved.at(-1)!;
    assertEquals(cluster.nodes.of(new NodeId(NODE_ID)).state, State.DESTROY_SUCCEEDED);
    const dispatchedNames = dispatcher.dispatched.map((e) => e.constructor.name);
    assertEquals(dispatchedNames, ["NodeDestroyStarted", "NodeDestroySucceeded"]);
  });
});

/** Throws on the first dispatch (the *_STARTED events) — simulating
 * a dispatch failure after the start transition that would leave the
 * node perma-stuck in *_STARTED without the stuck-state rescue. */
class ThrowingDispatcher implements Dispatcher {
  private first = true;
  dispatched: DomainEvent[] = [];
  dispatch(events: readonly DomainEvent[]): Promise<void> {
    if (this.first) {
      this.first = false;
      return Promise.reject(new Error("event sink unavailable"));
    }
    this.dispatched.push(...events);
    return Promise.resolve();
  }
}

describe("provisioning handlers — stuck-state rescue", () => {
  const cases = [
    {
      name: "plan",
      initial: State.REGISTERED,
      rescued: State.PLAN_FAILED,
      make: (c: ClustersStub, e: InMemoryExecutions, p: ProvisioningStub, d: Dispatcher) =>
        new PlanNodesHandler(c, e, p, d),
      command: () => new PlanNodes(CLUSTER_ID),
    },
    {
      name: "apply",
      initial: State.PLAN_SUCCEEDED,
      rescued: State.APPLY_FAILED,
      make: (c: ClustersStub, e: InMemoryExecutions, p: ProvisioningStub, d: Dispatcher) =>
        new ApplyNodesHandler(c, e, p, d),
      command: () => new ApplyNodes(CLUSTER_ID),
    },
    {
      name: "destroy",
      initial: State.APPLY_SUCCEEDED,
      rescued: State.DESTROY_FAILED,
      make: (c: ClustersStub, e: InMemoryExecutions, p: ProvisioningStub, d: Dispatcher) =>
        new DestroyNodesHandler(c, e, p, d),
      command: () => new DestroyNodes(CLUSTER_ID),
    },
  ] as const;

  for (const phase of cases) {
    it(`${phase.name}: a dispatch failure after start never leaves the node stuck in *_STARTED`, async () => {
      /* @Given a dispatcher that throws while publishing the started events */
      const executions = new InMemoryExecutions();
      const provisioning = new ProvisioningStub();
      const clusters = new ClustersStub(makeCluster(phase.initial));
      const handler = phase.make(clusters, executions, provisioning, new ThrowingDispatcher());

      /* @When the handler runs */
      // deno-lint-ignore no-explicit-any
      const op = await handler.handle(phase.command() as any);
      const { error } = await collect(executions, op.id);

      /* @Then the execution fails with the dispatch error */
      assertEquals(error, "event sink unavailable");
      /* @And the rescue moved the node to the failed terminal — not *_STARTED */
      const cluster = clusters.saved.at(-1)!;
      assertEquals(cluster.nodes.of(new NodeId(NODE_ID)).state, phase.rescued);
    });
  }
});

describe("provisioning handlers — failure paths share the same discipline", () => {
  it("apply: provisioning failure transitions the node to APPLY_FAILED and fails the execution", async () => {
    /* @Given a Provisioning that fails on apply */
    const executions = new InMemoryExecutions();
    const provisioning = new ProvisioningStub("apply");
    const clusters = new ClustersStub(makeCluster(State.PLAN_SUCCEEDED));
    const dispatcher = new TestDispatcher();
    const handler = new ApplyNodesHandler(clusters, executions, provisioning, dispatcher);

    /* @When the handler runs */
    const op = await handler.handle(new ApplyNodes(CLUSTER_ID));
    const { error } = await collect(executions, op.id);

    /* @Then the execution fails, the node lands in APPLY_FAILED, NodeApplyFailed dispatched */
    assertEquals(error, "apply boom");
    const cluster = clusters.saved.at(-1)!;
    assertEquals(cluster.nodes.of(new NodeId(NODE_ID)).state, State.APPLY_FAILED);
    const dispatchedNames = dispatcher.dispatched.map((e) => e.constructor.name);
    assertEquals(dispatchedNames, ["NodeApplyStarted", "NodeApplyFailed"]);
  });

  it("destroy: provisioning failure transitions the node to DESTROY_FAILED and fails the execution", async () => {
    /* @Given a Provisioning that fails on destroy */
    const executions = new InMemoryExecutions();
    const provisioning = new ProvisioningStub("destroy");
    const clusters = new ClustersStub(makeCluster(State.APPLY_SUCCEEDED));
    const dispatcher = new TestDispatcher();
    const handler = new DestroyNodesHandler(clusters, executions, provisioning, dispatcher);

    /* @When the handler runs */
    const op = await handler.handle(new DestroyNodes(CLUSTER_ID));
    const { error } = await collect(executions, op.id);

    /* @Then the execution fails, the node lands in DESTROY_FAILED, NodeDestroyFailed dispatched */
    assertEquals(error, "destroy boom");
    const cluster = clusters.saved.at(-1)!;
    assertEquals(cluster.nodes.of(new NodeId(NODE_ID)).state, State.DESTROY_FAILED);
    const dispatchedNames = dispatcher.dispatched.map((e) => e.constructor.name);
    assertEquals(dispatchedNames, ["NodeDestroyStarted", "NodeDestroyFailed"]);
  });
});
