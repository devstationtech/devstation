import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import { Server } from "@server/shared/inbound/rpc/server.ts";
import { EndpointRegistry } from "@server/shared/inbound/rpc/endpoint/endpoint-registry.ts";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import type {
  AuthenticatedSession,
  Authentication,
} from "@server/shared/authentication/domain/ports/outbound/authentication.ts";
import type { StationServicesByIdResponse } from "@jsonrpc-contracts-ts/station.gen.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Query as ServiceByIdQuery } from "@server/station/application/queries/services/by-id/query.ts";
import { ServiceByIdEndpoint } from "@server/station/inbound/rpc/endpoints.ts";
import { Persistence } from "@tests/station/integration/outbound/services-persistence.ts";

const STUB_SESSION_ID = "00000000-0000-0000-0000-000000000001";
const STATION_ID = "44444444-4444-4444-4444-444444444444";
const SERVICE_ID = "55555555-5555-5555-5555-555555555555";

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
  const endpoint = new ServiceByIdEndpoint(new ServiceByIdQuery(fs));
  const server = new Server(
    EndpointRegistry.empty(new StubAuthentication()).protected(endpoint),
    silentLogger,
    "test-core",
  );
  return new Client((req) => server.handle(req));
}

describe("station.services.byId endpoint — integration", () => {
  let persistence: Persistence;
  let rpc: Client;

  beforeAll(async () => {
    persistence = new Persistence();
    rpc = buildRpc(new FileSystem(persistence.dir));

    await Deno.writeTextFile(`${persistence.dir}/clusters.json`, JSON.stringify([]));
    await Deno.writeTextFile(
      `${persistence.dir}/stations.json`,
      JSON.stringify([{
        id: STATION_ID,
        version: 1,
        name: "homelab",
        description: "homelab",
        status: "REGISTERED",
        creation: { by: "alice", hostname: "host", at: "2026-01-01T00:00:00.000Z" },
        services: [{
          id: SERVICE_ID,
          name: "docker-host",
          blueprint: "docker",
          vaultId: "v",
          inputs: {},
          secrets: {},
          instances: [],
          host: null,
          status: "REGISTERED",
          installations: [],
          creation: { by: "alice", hostname: "host", at: "2026-01-01T00:00:00.000Z" },
        }],
      }]),
    );
  });

  afterAll(() => persistence.teardown());

  it("returns the service projection for an existing id", async () => {
    /* @Given a station with a known service */
    /* @When queried by that service id */
    const response = await rpc.invoke<StationServicesByIdResponse>(
      "station.services.byId",
      { sessionId: STUB_SESSION_ID, id: SERVICE_ID },
    );
    /* @Then the projection carries the service identity and owning station */
    assertEquals(response.id, SERVICE_ID);
    assertEquals(response.name, "docker-host");
    assertEquals(response.stationId, STATION_ID);
    assertEquals(response.blueprint, "docker");
  });

  it("rejects when the service does not exist", async () => {
    /* @Given an id no service exists for */
    /* @When queried by that id */
    /* @Then it rejects with a not-found error */
    await assertRejects(
      () =>
        rpc.invoke<StationServicesByIdResponse>("station.services.byId", {
          sessionId: STUB_SESSION_ID,
          id: "99999999-9999-9999-9999-999999999999",
        }),
      Exception,
      "not found",
    );
  });
});
