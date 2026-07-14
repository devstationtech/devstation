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
import type { StationServicesByBlueprintResponse } from "@jsonrpc-contracts-ts/station.gen.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Query as ServicesByBlueprintQuery } from "@server/station/application/queries/services/by-blueprint/query.ts";
import { ServicesByBlueprintEndpoint } from "@server/station/inbound/rpc/endpoints.ts";
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
  const endpoint = new ServicesByBlueprintEndpoint(new ServicesByBlueprintQuery(fs));
  const server = new Server(
    EndpointRegistry.empty(new StubAuthentication()).protected(endpoint),
    silentLogger,
    "test-core",
  );
  return new Client((req) => server.handle(req));
}

describe("station.services.byBlueprint endpoint — integration", () => {
  let persistence: Persistence;
  let rpc: Client;

  beforeAll(async () => {
    persistence = new Persistence();
    rpc = buildRpc(new FileSystem(persistence.dir));

    await Deno.writeTextFile(
      `${persistence.dir}/clusters.json`,
      JSON.stringify([]),
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
        services: [
          {
            id: "55555555-5555-5555-5555-555555555555",
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
          },
          {
            id: "66666666-6666-6666-6666-666666666666",
            name: "nginx",
            blueprint: "nginx",
            vaultId: "v",
            inputs: {},
            secrets: {},
            instances: [],
            host: null,
            status: "REGISTERED",
            installations: [],
            creation: { by: "alice", hostname: "host", at: "2026-01-01T00:00:00.000Z" },
          },
        ],
      }]),
    );
  });

  afterAll(() => persistence.teardown());

  it("returns only services with the matching blueprint", async () => {
    /* @Given a station with a "docker" and an "nginx" service */
    /* @When queried by the "docker" blueprint */
    const matching = await rpc.invoke<StationServicesByBlueprintResponse>(
      "station.services.byBlueprint",
      { sessionId: STUB_SESSION_ID, blueprint: "docker" },
    );
    /* @Then only the docker service is returned */
    assertEquals(matching.length, 1);
    assertEquals(matching[0].name, "docker-host");

    /* @And a blueprint with no services yields an empty array */
    const empty = await rpc.invoke<StationServicesByBlueprintResponse>(
      "station.services.byBlueprint",
      { sessionId: STUB_SESSION_ID, blueprint: "non-existent" },
    );
    assertEquals(empty, []);
  });
});
