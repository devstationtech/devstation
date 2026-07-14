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
import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import type {
  StationListResponse,
  StationRegisterResponse,
} from "@jsonrpc-contracts-ts/station.gen.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Adapter as StationsAdapter } from "@server/station/outbound/persistence/file-system/adapter.ts";
import { RegisterStationHandler } from "@server/station/application/handlers/register-station-handler.ts";
import { Query as AllStationsQuery } from "@server/station/application/queries/all/query.ts";
import {
  ListStationsEndpoint,
  RegisterStationEndpoint,
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

describe("station.list endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

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
        .protected(new ListStationsEndpoint(new AllStationsQuery(fs))),
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
    await rpc.invoke<StationRegisterResponse>("station.register", {
      sessionId: STUB_SESSION_ID,
      name: "edge",
      description: "edge workloads",
      user: "alice",
      hostname: "workstation",
    });
  });

  afterAll(() => persistence.teardown());

  it("returns every registered station with derived status and stats", async () => {
    /* @Given two registered stations */
    /* @When the stations are listed */
    const response = await rpc.invoke<StationListResponse>("station.list", {
      sessionId: STUB_SESSION_ID,
    });

    /* @Then both are returned with derived status and zeroed service stats */
    assertEquals(response.length, 2);
    const homelab = response.find((s) => s.name === "homelab")!;
    assertEquals(homelab.status, "REGISTERED");
    assertEquals(homelab.serviceCount, 0);
    assertEquals(homelab.serviceStats, {
      registered: 0,
      installing: 0,
      installed: 0,
      failed: 0,
      aborted: 0,
    });
  });

  it("returns an empty array when no station has been registered", async () => {
    /* @Given a fresh store with no stations registered */
    const tmp = new Persistence();
    try {
      const fs = new FileSystem(tmp.dir);
      const server = new Server(
        EndpointRegistry.empty(new StubAuthentication())
          .protected(new ListStationsEndpoint(new AllStationsQuery(fs))),
        silentLogger,
        "test-core",
      );
      const emptyRpc = new Client((req) => server.handle(req));
      /* @When the stations are listed */
      const response = await emptyRpc.invoke<StationListResponse>("station.list", {
        sessionId: STUB_SESSION_ID,
      });
      /* @Then an empty array is returned */
      assertEquals(response, []);
    } finally {
      await tmp.teardown();
    }
  });
});
