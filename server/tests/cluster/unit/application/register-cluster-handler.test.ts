import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { RegisterClusterHandler } from "@server/cluster/application/handlers/proxmox/register-cluster-handler.ts";
import { RegisterCluster } from "@server/cluster/application/commands/proxmox/register-cluster.ts";
import { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import { Id } from "@server/cluster/domain/models/id.ts";
import { Name } from "@server/cluster/domain/models/name.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";

/**
 * RegisterClusterHandler is the entry point for cluster registration
 * with two important rules: name uniqueness (checked via
 * Clusters.exists before constructing) and the creation metadata
 * stamped onto the aggregate. Domain only, no integration with the
 * wire — fake Clusters port suffices.
 */

function inMemoryClusters(initial: ProxmoxCluster[] = []): {
  clusters: Clusters;
  added: ProxmoxCluster[];
} {
  const added = [...initial];
  // deno-lint-ignore no-explicit-any
  const stub: any = {
    of: (id: { value: string }) => {
      const match = added.find((c) => c.id.value === id.value);
      if (!match) return Promise.reject(new Error(`cluster ${id.value} not found`));
      return Promise.resolve(match);
    },
    byName: (name: { value: string }) =>
      Promise.resolve(added.find((c) => c.name.value === name.value) ?? null),
    all: () => Promise.resolve(added),
    add: (cluster: ProxmoxCluster) => {
      added.push(cluster);
      return Promise.resolve();
    },
    update: () => Promise.reject(new Error("update() not used by RegisterClusterHandler")),
    remove: () => Promise.reject(new Error("remove() not used here")),
    exists: (name: { value: string }) =>
      Promise.resolve(added.some((c) => c.name.value === name.value)),
  };
  return { added, clusters: stub as Clusters };
}

describe("RegisterClusterHandler — happy path", () => {
  it("creates and persists a ProxmoxCluster when the name is free", async () => {
    /* @Given an empty store */
    const { clusters, added } = inMemoryClusters();
    const handler = new RegisterClusterHandler(clusters);
    /* @When register is called */
    await handler.handle(new RegisterCluster("homelab", "alice", "workstation"));
    /* @Then exactly one cluster was added with the right name/creator/host */
    assertEquals(added.length, 1);
    const cluster = added[0];
    assertEquals(cluster.name.value, "homelab");
    assertEquals(cluster.creation.by.value, "alice");
    assertEquals(cluster.creation.hostname.value, "workstation");
    /* @And the new aggregate starts at version 1 (no events drained yet) */
    assertEquals(cluster.version.value, 1);
  });

  it("stamps creation.at as 'now' (within the surrounding wall-clock window)", async () => {
    /* @Given a clean handler */
    const { clusters, added } = inMemoryClusters();
    const handler = new RegisterClusterHandler(clusters);
    /* @When register is called */
    const before = Date.now();
    await handler.handle(new RegisterCluster("homelab", "alice", "workstation"));
    const after = Date.now();
    /* @Then creation.at is within the surrounding window */
    const at = added[0].creation.at.date.getTime();
    assertEquals(at >= before, true);
    assertEquals(at <= after, true);
  });
});

describe("RegisterClusterHandler — uniqueness", () => {
  it("rejects when a cluster with the same name already exists", async () => {
    /* @Given a cluster 'homelab' already in the store */
    const seed = ProxmoxCluster.register(
      new Id(),
      new Name("homelab"),
      new Creation(
        new User("alice"),
        new Hostname("workstation"),
        Instant.fromString("2026-01-01T00:00:00.000Z"),
      ),
    );
    const { clusters, added } = inMemoryClusters([seed]);
    const handler = new RegisterClusterHandler(clusters);
    /* @When a second register with the same name runs */
    /* @Then it throws AND nothing new is persisted (size stays 1) */
    await assertRejects(
      () => handler.handle(new RegisterCluster("homelab", "bob", "laptop")),
      Error,
      "already exists",
    );
    assertEquals(added.length, 1);
  });
});

describe("RegisterClusterHandler — name validation", () => {
  it("propagates Name VO validation (uppercase rejected — Slug rules)", async () => {
    /* @Given any store */
    const { clusters } = inMemoryClusters();
    const handler = new RegisterClusterHandler(clusters);
    /* @When register runs with an uppercase name */
    /* @Then Name's Slug rule rejects it before exists() is consulted */
    await assertRejects(
      () => handler.handle(new RegisterCluster("Homelab", "alice", "workstation")),
      Error,
    );
  });
});
