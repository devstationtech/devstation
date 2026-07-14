import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { Adapter } from "@server/cluster/outbound/persistence/file-system/adapter.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import type { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import { State } from "@server/cluster/domain/models/proxmox/nodes/state.ts";
import { register, registerNode } from "@tests/cluster/fixtures/operations.ts";

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

/**
 * `clusters.json` is one document for the whole collection, so a
 * plain read-modify-write loses concurrent changes (last writer wins).
 * `Clusters.update` serializes the critical section and reloads fresh
 * under the lock — concurrent commands on different nodes of the same
 * cluster must both survive.
 */
describe("Clusters adapter — update serializes concurrent writes", () => {
  let dir: string;
  let adapter: Adapter;

  beforeEach(() => {
    dir = Deno.makeTempDirSync();
    adapter = new Adapter(new FileSystem(dir), silentLogger);
  });

  afterEach(() => {
    Deno.removeSync(dir, { recursive: true });
  });

  it("does not lose a concurrent update on a different node (no last-writer-wins)", async () => {
    /* @Given a persisted cluster with two nodes */
    const cluster = register();
    const a = registerNode("a", "192.168.1.1");
    const b = registerNode("b", "192.168.1.2");
    cluster.registerNode(a);
    cluster.registerNode(b);
    await adapter.add(cluster);

    /* @When two updates on different nodes run concurrently */
    // Fire both without awaiting the first — the unguarded
    // read-modify-write would interleave and drop one change.
    await Promise.all([
      adapter.update<ProxmoxCluster>(cluster.id, (c) => c.startPlan(a.id)),
      adapter.update<ProxmoxCluster>(cluster.id, (c) => c.startPlan(b.id)),
    ]);

    /* @Then both changes survive — neither is clobbered */
    const reloaded = await adapter.of<ProxmoxCluster>(cluster.id);
    const sa = reloaded.nodes.items.find((n) => n.id.value === a.id.value)!.state;
    const sb = reloaded.nodes.items.find((n) => n.id.value === b.id.value)!.state;
    assertEquals(sa, State.PLAN_STARTED);
    assertEquals(sb, State.PLAN_STARTED); // both survive — neither clobbered
  });

  it("returns the mutated aggregate, persists it, and bumps version", async () => {
    /* @Given a persisted cluster with one node at a known version */
    const cluster = register();
    const node = registerNode("n", "192.168.1.10");
    cluster.registerNode(node);
    await adapter.add(cluster);
    const baseVersion = (await adapter.of<ProxmoxCluster>(cluster.id)).version.value;

    /* @When the node is mutated through update */
    const returned = await adapter.update<ProxmoxCluster>(
      cluster.id,
      (c) => c.startPlan(node.id),
    );

    /* @Then the mutated aggregate is returned, persisted and the version bumped */
    assertEquals(returned.nodes.items[0].state, State.PLAN_STARTED);
    const reloaded = await adapter.of<ProxmoxCluster>(cluster.id);
    assertEquals(reloaded.nodes.items[0].state, State.PLAN_STARTED);
    assertEquals(reloaded.version.value > baseVersion, true);
  });
});
