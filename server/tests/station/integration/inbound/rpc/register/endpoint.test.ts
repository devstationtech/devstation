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
import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import type { StationRegisterResponse } from "@jsonrpc-contracts-ts/station.gen.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Adapter as StationsAdapter } from "@server/station/outbound/persistence/file-system/adapter.ts";
import { RegisterStationHandler } from "@server/station/application/handlers/register-station-handler.ts";
import { RegisterStationEndpoint } from "@server/station/inbound/rpc/endpoints.ts";
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

class StubDispatcher implements Dispatcher {
  dispatch(): Promise<void> {
    return Promise.resolve();
  }
}

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

describe("station.register endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeAll(() => {
    persistence = new Persistence();
    const fs = new FileSystem(persistence.dir);
    const adapter = new StationsAdapter(fs);
    const handler = new RegisterStationHandler(adapter, new StubDispatcher());
    const endpoint = new RegisterStationEndpoint(handler);
    const server = new Server(
      EndpointRegistry.empty(new StubAuthentication()).protected(endpoint),
      silentLogger,
      "test-core",
    );
    rpc = new Client((request) => server.handle(request));
  });

  afterAll(() => persistence.teardown());

  it("registers a new station and persists it", async () => {
    /* @Given a fresh store and station details */
    /* @When the station is registered */
    await rpc.invoke<StationRegisterResponse>("station.register", {
      sessionId: STUB_SESSION_ID,
      name: "homelab",
      description: "homelab workloads",
      user: "alice",
      hostname: "workstation",
    });

    /* @Then it is persisted with the given fields and version 1 */
    const stations = await persistence.readStations();
    assertEquals(stations.length, 1);
    assertEquals(stations[0].name, "homelab");
    assertEquals(stations[0].description, "homelab workloads");
    assertEquals(stations[0].creation.by, "alice");
    assertEquals(stations[0].version, 1);
  });

  it("rejects a duplicate name", async () => {
    /* @Given a station already registered as "homelab" */
    /* @When registering another station with the same name */
    /* @Then it rejects with an already-registered error */
    await assertRejects(
      () =>
        rpc.invoke<StationRegisterResponse>("station.register", {
          sessionId: STUB_SESSION_ID,
          name: "homelab",
          description: "second",
          user: "bob",
          hostname: "ops",
        }),
      Exception,
      "already registered",
    );
  });
});
