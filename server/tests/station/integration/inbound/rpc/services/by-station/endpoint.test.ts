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
import type { StationServicesByStationResponse } from "@jsonrpc-contracts-ts/station.gen.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Query as ServicesByStationQuery } from "@server/station/application/queries/services/by-station/query.ts";
import { ServicesByStationEndpoint } from "@server/station/inbound/rpc/endpoints.ts";
import { Persistence } from "@tests/station/integration/outbound/services-persistence.ts";

const STUB_SESSION_ID = "00000000-0000-0000-0000-000000000001";
const STATION_A = "44444444-4444-4444-4444-444444444444";
const STATION_B = "55555555-5555-5555-5555-555555555555";

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
  const endpoint = new ServicesByStationEndpoint(new ServicesByStationQuery(fs));
  const server = new Server(
    EndpointRegistry.empty(new StubAuthentication()).protected(endpoint),
    silentLogger,
    "test-core",
  );
  return new Client((req) => server.handle(req));
}

describe("station.services.byStation endpoint — integration", () => {
  let persistence: Persistence;
  let rpc: Client;

  beforeAll(async () => {
    persistence = new Persistence();
    rpc = buildRpc(new FileSystem(persistence.dir));

    await Deno.writeTextFile(`${persistence.dir}/clusters.json`, JSON.stringify([]));
    await Deno.writeTextFile(
      `${persistence.dir}/stations.json`,
      JSON.stringify([
        {
          id: STATION_A,
          version: 1,
          name: "homelab",
          description: "homelab",
          status: "REGISTERED",
          creation: { by: "alice", hostname: "host", at: "2026-01-01T00:00:00.000Z" },
          services: [{
            id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            name: "svc-a",
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
        },
        {
          id: STATION_B,
          version: 1,
          name: "edge",
          description: "edge",
          status: "REGISTERED",
          creation: { by: "alice", hostname: "host", at: "2026-01-01T00:00:00.000Z" },
          services: [{
            id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            name: "svc-b",
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
        },
      ]),
    );
  });

  afterAll(() => persistence.teardown());

  it("returns only services that belong to the requested station", async () => {
    /* @Given two stations each owning one service */
    /* @When queried by station A */
    const responseA = await rpc.invoke<StationServicesByStationResponse>(
      "station.services.byStation",
      { sessionId: STUB_SESSION_ID, stationId: STATION_A },
    );
    /* @Then only station A's service is returned */
    assertEquals(responseA.length, 1);
    assertEquals(responseA[0].name, "svc-a");
    assertEquals(responseA[0].stationId, STATION_A);
  });

  it("returns an empty array when the station has no services", async () => {
    /* @Given a station id with no services */
    /* @When queried by that station */
    const response = await rpc.invoke<StationServicesByStationResponse>(
      "station.services.byStation",
      { sessionId: STUB_SESSION_ID, stationId: "00000000-0000-0000-0000-000000000999" },
    );
    /* @Then an empty array is returned */
    assertEquals(response, []);
  });
});
