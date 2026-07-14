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
import type { StationServicesListResponse } from "@jsonrpc-contracts-ts/station.gen.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Query as AllServicesQuery } from "@server/station/application/queries/services/all/query.ts";
import { ListServicesEndpoint } from "@server/station/inbound/rpc/endpoints.ts";
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
  const endpoint = new ListServicesEndpoint(new AllServicesQuery(fs));
  const server = new Server(
    EndpointRegistry.empty(new StubAuthentication()).protected(endpoint),
    silentLogger,
    "test-core",
  );
  return new Client((req) => server.handle(req));
}

describe("station.services.list endpoint — integration", () => {
  let persistence: Persistence;
  let rpc: Client;

  beforeAll(() => {
    persistence = new Persistence();
    rpc = buildRpc(new FileSystem(persistence.dir));
  });

  afterAll(() => persistence.teardown());

  it("returns an empty array when no station/service exists", async () => {
    /* @Given no stations or services on disk */
    /* @When services are listed */
    const response = await rpc.invoke<StationServicesListResponse>(
      "station.services.list",
      { sessionId: STUB_SESSION_ID },
    );
    /* @Then an empty array is returned */
    assertEquals(response, []);
  });

  it("flattens services across stations and enriches each instance with provider/cluster/node", async () => {
    /* @Given a cluster VM and a station service whose instance lands on it */
    await Deno.writeTextFile(
      `${persistence.dir}/clusters.json`,
      JSON.stringify([
        {
          provider: "proxmox",
          id: "c1",
          name: "homelab",
          version: 1,
          creation: { by: "alice", hostname: "host", at: "2026-01-01T00:00:00.000Z" },
          images: [],
          nodes: [{
            id: "n1",
            name: "node-1",
            address: "10.0.0.10",
            credential: { vaultId: "v", usernameSecretId: "u", passwordSecretId: "p" },
            images: [],
            virtualMachines: [{
              id: 100,
              name: "vm-100",
              roleId: "role-1",
              sizeId: "def-1",
              image: "img-1",
              environmentId: "env-1",
              address: "10.0.0.100",
              gateway: "10.0.0.1",
              dns: "10.0.0.1",
              storage: "local",
              credentialVaultId: "v",
              usernameSecretId: "u",
              passwordSecretId: "p",
              resources: { cpu: 2, ram: 1024, disk: 20 },
              services: [],
            }],
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
          vaultId: "v",
          inputs: {},
          secrets: {},
          instances: [{
            role: "main",
            host: "10.0.0.100",
            credential: { vaultId: "v", username: "u", password: "p" },
          }],
          host: null,
          status: "REGISTERED",
          installations: [],
          creation: { by: "alice", hostname: "host", at: "2026-01-01T00:00:00.000Z" },
        }],
      }]),
    );

    /* @When services are listed */
    const response = await rpc.invoke<StationServicesListResponse>(
      "station.services.list",
      { sessionId: STUB_SESSION_ID },
    );

    /* @Then the service is flattened and its instance enriched with provider/cluster/node */
    assertEquals(response.length, 1);
    const service = response[0];
    assertEquals(service.name, "docker-host");
    assertEquals(service.stationId, "44444444-4444-4444-4444-444444444444");
    assertEquals(service.host, null);
    assertEquals(service.lastInstalledAt, null);
    assertEquals(service.instances.length, 1);
    assertEquals(service.instances[0].name, "vm-100");
    assertEquals(service.instances[0].provider, "proxmox");
    assertEquals(service.instances[0].cluster, "homelab");
    assertEquals(service.instances[0].node, "node-1");
  });
});
