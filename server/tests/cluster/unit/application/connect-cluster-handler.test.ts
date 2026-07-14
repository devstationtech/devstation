import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ConnectClusterHandler } from "@server/cluster/application/handlers/proxmox/connect-cluster-handler.ts";
import { ConnectCluster } from "@server/cluster/application/commands/proxmox/connect-cluster.ts";
import { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import { Id } from "@server/cluster/domain/models/id.ts";
import { Name } from "@server/cluster/domain/models/name.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import type { Cluster } from "@server/cluster/domain/models/cluster.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";
import type { SecretResolver } from "@server/shared/secrets/domain/ports/outbound/secret-resolver.ts";

// deno-lint-ignore no-explicit-any
type Anyish = any;

const stubSecrets: SecretResolver = {
  resolve: () => Promise.resolve("stub-token"),
};

const stubIntegration = () => ({ clusterResources: () => Promise.resolve([]) }) as Anyish;

function buildHandler(
  clusters: Clusters,
  opts: {
    secrets?: SecretResolver;
    integration?: ReturnType<typeof stubIntegration>;
    probeError?: Error;
  } = {},
): ConnectClusterHandler {
  const factory = opts.probeError
    ? () => ({ clusterResources: () => Promise.reject(opts.probeError) }) as Anyish
    : () => opts.integration ?? stubIntegration();
  return new ConnectClusterHandler(
    clusters,
    opts.secrets ?? stubSecrets,
    factory,
  );
}

/**
 * ConnectClusterHandler attaches a Proxmox connection to a cluster.
 * Pins two contracts:
 *  - happy path: connect mutates the aggregate via update();
 *  - non-Proxmox cluster: handler refuses with a clear "is not a
 *    proxmox cluster" error so a future cluster provider can't be
 *    silently configured with Proxmox credentials.
 */

function fakeClustersWith(cluster: Cluster): { clusters: Clusters } {
  // deno-lint-ignore no-explicit-any
  const stub: any = {
    of: () => Promise.resolve(cluster),
    update: async <T>(_id: unknown, change: (c: T) => unknown) => {
      await change(cluster as unknown as T);
      return cluster;
    },
    add: () => Promise.reject(new Error("not used")),
    remove: () => Promise.reject(new Error("not used")),
    exists: () => Promise.resolve(true),
    byName: () => Promise.resolve(null),
    all: () => Promise.resolve([cluster]),
  };
  return { clusters: stub as Clusters };
}

function aProxmoxCluster(): ProxmoxCluster {
  return ProxmoxCluster.register(
    new Id(),
    new Name("homelab"),
    new Creation(
      new User("alice"),
      new Hostname("workstation"),
      Instant.fromString("2026-01-01T00:00:00.000Z"),
    ),
  );
}

describe("ConnectClusterHandler — happy path", () => {
  it("attaches a Proxmox connection to a Proxmox cluster via update()", async () => {
    /* @Given a Proxmox cluster without a connection */
    const cluster = aProxmoxCluster();
    const { clusters } = fakeClustersWith(cluster);
    const handler = buildHandler(clusters);
    /* @When connect runs with valid connection params */
    await handler.handle(
      new ConnectCluster(
        cluster.id.value,
        "proxmox.example.com",
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
      ),
    );
    /* @Then the cluster carries the connection (host + vault + secret) */
    assertEquals(cluster.connection?.host.value, "proxmox.example.com");
    assertEquals(cluster.connection?.vault.value, "00000000-0000-0000-0000-000000000001");
    assertEquals(cluster.connection?.secret.value, "00000000-0000-0000-0000-000000000002");
  });
});

describe("ConnectClusterHandler — provider guard", () => {
  it("refuses to connect a non-Proxmox cluster (defensive — future-proof for other providers)", async () => {
    /* @Given a Cluster that is NOT a ProxmoxCluster */
    /* (stub: any object with the same id surface; the handler's instanceof check catches it) */
    // deno-lint-ignore no-explicit-any
    const fakeNonProxmox: any = {
      id: new Id(),
      name: new Name("homelab"),
      provider: "vmware",
      version: { value: 1 },
      events: { pull: () => [], size: 0 },
      creation: new Creation(
        new User("alice"),
        new Hostname("workstation"),
        Instant.fromString("2026-01-01T00:00:00.000Z"),
      ),
    };
    const { clusters } = fakeClustersWith(fakeNonProxmox);
    const handler = buildHandler(clusters);
    /* @When connect runs */
    /* @Then it throws with the exact phrase 'is not a proxmox cluster' */
    await assertRejects(
      () =>
        handler.handle(
          new ConnectCluster(
            fakeNonProxmox.id.value,
            "proxmox.example.com",
            "00000000-0000-0000-0000-000000000001",
            "00000000-0000-0000-0000-000000000002",
          ),
        ),
      Error,
      "not a proxmox cluster",
    );
  });
});

describe("ConnectClusterHandler — probe gate (connect refuses when secret cannot be resolved)", () => {
  it("refuses connect when the secret cannot be resolved", async () => {
    const cluster = aProxmoxCluster();
    const { clusters } = fakeClustersWith(cluster);
    const handler = buildHandler(clusters, {
      secrets: { resolve: () => Promise.resolve(null) },
    });
    await assertRejects(
      () =>
        handler.handle(
          new ConnectCluster(
            cluster.id.value,
            "proxmox.example.com",
            "00000000-0000-0000-0000-000000000001",
            "00000000-0000-0000-0000-000000000002",
          ),
        ),
      Error,
      "secret",
    );
    // No partial mutation — connection stays unset.
    assertEquals(cluster.connection, undefined);
  });

  it("refuses connect when the API probe fails", async () => {
    const cluster = aProxmoxCluster();
    const { clusters } = fakeClustersWith(cluster);
    const handler = buildHandler(clusters, {
      probeError: new Error("auth failed"),
    });
    await assertRejects(
      () =>
        handler.handle(
          new ConnectCluster(
            cluster.id.value,
            "proxmox.example.com",
            "00000000-0000-0000-0000-000000000001",
            "00000000-0000-0000-0000-000000000002",
          ),
        ),
      Error,
      "probe failed",
    );
    assertEquals(cluster.connection, undefined);
  });

  it("persists the connection only after a successful probe", async () => {
    const cluster = aProxmoxCluster();
    const { clusters } = fakeClustersWith(cluster);
    let probed = false;
    const handler = buildHandler(clusters, {
      integration: ({
        clusterResources: () => {
          probed = true;
          return Promise.resolve([]);
        },
      }) as Anyish,
    });
    await handler.handle(
      new ConnectCluster(
        cluster.id.value,
        "proxmox.example.com",
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
      ),
    );
    assertEquals(probed, true);
    assertEquals(cluster.connection?.host.value, "proxmox.example.com");
  });
});

describe("ConnectClusterHandler — propagation", () => {
  it("propagates Hostname VO validation when the host has whitespace", async () => {
    /* @Given a Proxmox cluster */
    const cluster = aProxmoxCluster();
    const { clusters } = fakeClustersWith(cluster);
    const handler = buildHandler(clusters);
    /* @When connect runs with a malformed host (Hostname VO rejects whitespace) */
    await assertRejects(
      () =>
        handler.handle(
          new ConnectCluster(
            cluster.id.value,
            "proxmox example.com", // <- space
            "00000000-0000-0000-0000-000000000001",
            "00000000-0000-0000-0000-000000000002",
          ),
        ),
      Error,
      "hostname",
    );
    /* @And the cluster connection stays unset (no partial mutation) */
    assertEquals(cluster.connection, undefined);
  });
});
