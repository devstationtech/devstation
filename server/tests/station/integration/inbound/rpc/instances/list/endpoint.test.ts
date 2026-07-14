import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Server } from "@server/shared/inbound/rpc/server.ts";
import { EndpointRegistry } from "@server/shared/inbound/rpc/endpoint/endpoint-registry.ts";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import type {
  AuthenticatedSession,
  Authentication,
} from "@server/shared/authentication/domain/ports/outbound/authentication.ts";
import type { StationInstancesListResponse } from "@jsonrpc-contracts-ts/station.gen.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Query as AllInstancesQuery } from "@server/station/application/queries/instances/all/query.ts";
import { ListInstancesEndpoint } from "@server/station/inbound/rpc/endpoints.ts";
import { Persistence } from "@tests/station/integration/outbound/services-persistence.ts";

const STUB_SESSION_ID = "00000000-0000-0000-0000-000000000001";

class StubAuthentication implements Authentication {
  check(_: string): AuthenticatedSession {
    return {
      sessionId: STUB_SESSION_ID,
      key: "a".repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
    };
  }
}

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

function buildRpc(fs: FileSystem): Client {
  const endpoint = new ListInstancesEndpoint(new AllInstancesQuery(fs));
  const server = new Server(
    EndpointRegistry.empty(new StubAuthentication()).protected(endpoint),
    silentLogger,
    "test-core",
  );
  return new Client((request) => server.handle(request));
}

describe("station.instances.list endpoint — integration", () => {
  let persistence: Persistence;
  let rpc: Client;

  beforeAll(() => {
    persistence = new Persistence();
    rpc = buildRpc(new FileSystem(persistence.dir));
  });

  afterAll(() => persistence.teardown());

  it("returns an empty array when no cluster/station files exist", async () => {
    /* @Given no cluster or station files on disk */
    /* @When instances are listed */
    const response = await rpc.invoke<StationInstancesListResponse>(
      "station.instances.list",
      { sessionId: STUB_SESSION_ID },
    );
    /* @Then an empty array is returned */
    assertEquals(response, []);
  });

  it("projects every VM and marks instances busy when occupied by a service", async () => {
    /* @Given a cluster with a free VM and a VM occupied by a service */
    await Deno.writeTextFile(
      `${persistence.dir}/clusters.json`,
      JSON.stringify([
        {
          provider: "proxmox",
          id: "c1",
          name: "homelab",
          version: 1,
          creation: { by: "alice", hostname: "host", at: "2026-01-01T00:00:00.000Z" },
          nodes: [{
            id: "n1",
            name: "node-1",
            address: "10.0.0.10",
            credential: { vaultId: "v", usernameSecretId: "u", passwordSecretId: "p" },
            images: [{ imageId: "img-1", name: "ubuntu-2204", os: "ubuntu" }],
            virtualMachines: [
              {
                id: 100,
                name: "free-vm",
                roleId: "role-1",
                sizeId: "def-1",
                image: "img-1",
                environmentId: "env-1",
                address: "10.0.0.100",
                gateway: "10.0.0.1",
                dns: "10.0.0.1",
                storage: "local",
                credentialVaultId: "11111111-1111-1111-1111-111111111111",
                usernameSecretId: "22222222-2222-2222-2222-222222222222",
                passwordSecretId: "33333333-3333-3333-3333-333333333333",
                resources: { cpu: 2, ram: 1024, disk: 20 },
                services: [],
              },
              {
                id: 101,
                name: "busy-vm",
                roleId: "role-1",
                sizeId: "def-1",
                image: "img-1",
                environmentId: "env-1",
                address: "10.0.0.101",
                gateway: "10.0.0.1",
                dns: "10.0.0.1",
                storage: "local",
                credentialVaultId: "11111111-1111-1111-1111-111111111111",
                usernameSecretId: "22222222-2222-2222-2222-222222222222",
                passwordSecretId: "33333333-3333-3333-3333-333333333333",
                resources: { cpu: 4, ram: 2048, disk: 40 },
                services: [],
              },
            ],
          }],
        },
      ]),
    );
    await Deno.writeTextFile(
      `${persistence.dir}/stations.json`,
      JSON.stringify([{
        id: "44444444-4444-4444-4444-444444444444",
        version: 1,
        name: "homelab",
        description: "homelab",
        status: "REGISTERED",
        creation: { by: "alice", hostname: "host", at: "2026-01-01T00:00:00.000Z" },
        services: [{
          id: "55555555-5555-5555-5555-555555555555",
          name: "docker-host",
          blueprint: "docker",
          vaultId: "11111111-1111-1111-1111-111111111111",
          inputs: {},
          secrets: {},
          instances: [{
            role: "main",
            host: "10.0.0.101",
            credential: { vaultId: "v", username: "u", password: "p" },
          }],
          host: null,
          status: "REGISTERED",
          installations: [],
          creation: { by: "alice", hostname: "host", at: "2026-01-01T00:00:00.000Z" },
        }],
      }]),
    );

    /* @When instances are listed */
    const response = await rpc.invoke<StationInstancesListResponse>(
      "station.instances.list",
      { sessionId: STUB_SESSION_ID },
    );

    /* @Then every VM is projected, the free one idle and the occupied one busyBy the service */
    assertEquals(response.length, 2);
    const free = response.find((r) => r.host === "10.0.0.100")!;
    assertEquals(free.busy, false);
    assertEquals(free.busyBy, null);
    assertEquals(free.specs.cpu, 2);

    const busy = response.find((r) => r.host === "10.0.0.101")!;
    assertEquals(busy.busy, true);
    assertEquals(busy.busyBy!.serviceName, "docker-host");
    assertEquals(busy.busyBy!.role, "main");
  });
});
