import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Server } from "@server/shared/inbound/rpc/server.ts";
import { EndpointRegistry } from "@server/shared/inbound/rpc/endpoint/endpoint-registry.ts";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import type { ClusterProxmoxTestConnectionResponse } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { Query as TestProxmoxConnectionQuery } from "@server/cluster/application/queries/proxmox/test-connection/query.ts";
import type { ProxmoxIntegration } from "@server/cluster/application/queries/proxmox/api/integration.ts";
import type { ClusterResource } from "@server/cluster/application/queries/proxmox/api/response/cluster-resource.ts";
import { TestProxmoxConnectionEndpoint } from "@server/cluster/inbound/rpc/proxmox/test-connection/endpoint.ts";
import { STUB_SESSION_ID, StubAuthentication } from "@tests/cluster/fixtures/bootstrap.ts";

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

function fakeIntegration(
  resources: ClusterResource[] | (() => never),
): ProxmoxIntegration {
  return {
    clusterResources: () => {
      if (typeof resources === "function") return resources();
      return Promise.resolve(resources);
    },
  } as unknown as ProxmoxIntegration;
}

function buildRpc(query: TestProxmoxConnectionQuery): Client {
  const endpoint = new TestProxmoxConnectionEndpoint(query);
  const server = new Server(
    EndpointRegistry.empty(new StubAuthentication()).protected(endpoint),
    silentLogger,
    "test-core",
  );
  return new Client((request) => server.handle(request));
}

describe("cluster.proxmox.testConnection endpoint — integration", () => {
  it("returns ok with node count when the integration succeeds", async () => {
    /* @Given an integration that lists 2 nodes and 3 qemus */
    const query = new TestProxmoxConnectionQuery(() =>
      fakeIntegration([
        { type: "node" } as ClusterResource,
        { type: "node" } as ClusterResource,
        { type: "qemu" } as ClusterResource,
        { type: "qemu" } as ClusterResource,
        { type: "qemu" } as ClusterResource,
      ])
    );
    const rpc = buildRpc(query);

    /* @When testConnection is invoked */
    const response = await rpc.invoke<ClusterProxmoxTestConnectionResponse>(
      "cluster.proxmox.testConnection",
      { sessionId: STUB_SESSION_ID, host: "host", token: "token" },
    );

    /* @Then the response is the ok variant with nodeCount */
    assertEquals(response, { ok: true, nodeCount: 2 });
  });

  it("returns the failed variant when the integration throws", async () => {
    /* @Given an integration that throws */
    const query = new TestProxmoxConnectionQuery(() =>
      fakeIntegration(() => {
        throw new Error("connection refused.");
      })
    );
    const rpc = buildRpc(query);

    /* @When testConnection is invoked */
    const response = await rpc.invoke<ClusterProxmoxTestConnectionResponse>(
      "cluster.proxmox.testConnection",
      { sessionId: STUB_SESSION_ID, host: "host", token: "token" },
    );

    /* @Then the response is the failed variant with the error message */
    assertEquals(response, { ok: false, error: "connection refused." });
  });
});
