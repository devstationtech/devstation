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
import type {
  StationRegisterResponse,
  StationUpdateResponse,
} from "@jsonrpc-contracts-ts/station.gen.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Adapter as StationsAdapter } from "@server/station/outbound/persistence/file-system/adapter.ts";
import { RegisterStationHandler } from "@server/station/application/handlers/register-station-handler.ts";
import { UpdateStationHandler } from "@server/station/application/handlers/update-station-handler.ts";
import { RegisterStationEndpoint } from "@server/station/inbound/rpc/endpoints.ts";
import { UpdateStationEndpoint } from "@server/station/inbound/rpc/endpoints.ts";
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

describe("station.update endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;
  let stationId: string;

  beforeAll(async () => {
    persistence = new Persistence();
    const fs = new FileSystem(persistence.dir);
    const adapter = new StationsAdapter(fs);
    const dispatcher = new StubDispatcher();
    const registerEndpoint = new RegisterStationEndpoint(
      new RegisterStationHandler(adapter, dispatcher),
    );
    const updateEndpoint = new UpdateStationEndpoint(
      new UpdateStationHandler(adapter, dispatcher),
    );
    const server = new Server(
      EndpointRegistry.empty(new StubAuthentication())
        .protected(registerEndpoint)
        .protected(updateEndpoint),
      silentLogger,
      "test-core",
    );
    rpc = new Client((request) => server.handle(request));

    await rpc.invoke<StationRegisterResponse>("station.register", {
      sessionId: STUB_SESSION_ID,
      name: "homelab",
      description: "homelab workloads",
      user: "alice",
      hostname: "workstation",
    });
    stationId = (await persistence.readStations())[0].id;

    await rpc.invoke<StationRegisterResponse>("station.register", {
      sessionId: STUB_SESSION_ID,
      name: "edge",
      description: "edge workloads",
      user: "alice",
      hostname: "workstation",
    });
  });

  afterAll(() => persistence.teardown());

  it("updates the station's name and description", async () => {
    /* @Given a registered station */
    /* @When its name and description are updated */
    await rpc.invoke<StationUpdateResponse>("station.update", {
      sessionId: STUB_SESSION_ID,
      stationId,
      name: "homelab-prod",
      description: "production homelab",
    });

    /* @Then the persisted record reflects the new values */
    const stations = await persistence.readStations();
    const updated = stations.find((s) => s.id === stationId)!;
    assertEquals(updated.name, "homelab-prod");
    assertEquals(updated.description, "production homelab");
  });

  it("rejects when the new name collides with another station", async () => {
    /* @Given two stations, one named "edge" */
    /* @When the other is updated to the name "edge" */
    /* @Then it rejects with an already-registered error */
    await assertRejects(
      () =>
        rpc.invoke<StationUpdateResponse>("station.update", {
          sessionId: STUB_SESSION_ID,
          stationId,
          name: "edge",
          description: "trying to steal the edge name",
        }),
      Exception,
      "already registered",
    );
  });

  it("rejects when the station does not exist", async () => {
    /* @Given an id no station was registered with */
    /* @When updating by that id */
    /* @Then it rejects with a not-found error */
    await assertRejects(
      () =>
        rpc.invoke<StationUpdateResponse>("station.update", {
          sessionId: STUB_SESSION_ID,
          stationId: "00000000-0000-0000-0000-000000000999",
          name: "anything",
          description: "anything",
        }),
      Exception,
      "not found",
    );
  });
});
