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
  StationUnregisterResponse,
} from "@jsonrpc-contracts-ts/station.gen.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Adapter as StationsAdapter } from "@server/station/outbound/persistence/file-system/adapter.ts";
import { RegisterStationHandler } from "@server/station/application/handlers/register-station-handler.ts";
import { UnregisterStationHandler } from "@server/station/application/handlers/unregister-station-handler.ts";
import {
  RegisterStationEndpoint,
  UnregisterStationEndpoint,
} from "@server/station/inbound/rpc/endpoints.ts";
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

describe("station.unregister endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;
  let stationId: string;

  beforeAll(async () => {
    persistence = new Persistence();
    const fs = new FileSystem(persistence.dir);
    const adapter = new StationsAdapter(fs);
    const dispatcher = new StubDispatcher();
    const server = new Server(
      EndpointRegistry.empty(new StubAuthentication())
        .protected(
          new RegisterStationEndpoint(
            new RegisterStationHandler(adapter, dispatcher),
          ),
        )
        .protected(
          new UnregisterStationEndpoint(
            new UnregisterStationHandler(adapter, dispatcher),
          ),
        ),
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
  });

  afterAll(() => persistence.teardown());

  it("unregisters an existing station", async () => {
    /* @Given a registered station */
    /* @When it is removed by id */
    await rpc.invoke<StationUnregisterResponse>("station.unregister", {
      sessionId: STUB_SESSION_ID,
      stationId,
    });
    /* @Then the store no longer holds any station */
    assertEquals(await persistence.readStations(), []);
  });

  it("rejects when the station does not exist", async () => {
    /* @Given an id no station was registered with */
    /* @When removing by that id */
    /* @Then it rejects with a not-found error */
    await assertRejects(
      () =>
        rpc.invoke<StationUnregisterResponse>("station.unregister", {
          sessionId: STUB_SESSION_ID,
          stationId: "00000000-0000-0000-0000-000000000999",
        }),
      Exception,
      "not found",
    );
  });
});
