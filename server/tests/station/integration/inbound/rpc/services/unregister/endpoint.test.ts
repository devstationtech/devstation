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
  StationServicesRegisterRequest,
  StationServicesRegisterResponse,
  StationServicesUnregisterResponse,
} from "@jsonrpc-contracts-ts/station.gen.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { Blueprints } from "@server/blueprint/blueprints.ts";
import {
  Blueprint,
  Compatibility,
  Description,
  Name as BlueprintName,
  Role,
  SemVer,
  Step,
  StepDescription,
  StepId,
} from "@server/blueprint/index.ts";
import { Publish } from "@server/blueprint/domain/models/step/publish.ts";
import { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";
import { Adapter as StationsAdapter } from "@server/station/outbound/persistence/file-system/adapter.ts";
import { RegisterServiceHandler } from "@server/station/application/handlers/register-service-handler.ts";
import { UnregisterServiceHandler } from "@server/station/application/handlers/unregister-service-handler.ts";
import {
  RegisterServiceEndpoint,
  UnregisterServiceEndpoint,
} from "@server/station/inbound/rpc/endpoints.ts";
import { seedStation } from "@tests/station/fixtures/service-bootstrap.ts";
import { Persistence } from "@tests/station/integration/outbound/services-persistence.ts";

const STUB_SESSION_ID = "00000000-0000-0000-0000-000000000001";
const VAULT_ID = "11111111-1111-1111-1111-111111111111";
const STATION_ID = "44444444-4444-4444-4444-444444444444";
const USERNAME_SECRET = "22222222-2222-2222-2222-222222222222";
const PASSWORD_SECRET = "33333333-3333-3333-3333-333333333333";

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

class StubBlueprints {
  of(_name: BlueprintName): Promise<Blueprint> {
    return Promise.resolve(
      new Blueprint(
        new BlueprintName("docker"),
        new Description("docker"),
        new SemVer("1.0.0"),
        new Compatibility([OperatingSystem.UBUNTU_22_04]),
        "exclusive",
        [],
        [
          new Role("main", "one", [
            new Step(
              new StepId("install"),
              new StepDescription("install"),
              "echo install",
              {},
              null,
              new Publish({}, {}),
              null,
            ),
          ]),
        ],
        null,
        [],
      ),
    );
  }
  contains(_name: BlueprintName): Promise<boolean> {
    return Promise.resolve(true);
  }
  list(): Promise<Blueprint[]> {
    return Promise.resolve([]);
  }
}

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

function registerReq(name: string): StationServicesRegisterRequest {
  return {
    sessionId: STUB_SESSION_ID,
    stationId: STATION_ID,
    name,
    blueprint: "docker",
    vaultId: VAULT_ID,
    inputs: {},
    secrets: {},
    user: "test-user",
    hostname: "test-host",
    instances: [{
      role: "main",
      host: "10.0.0.1",
      credentialVaultId: VAULT_ID,
      usernameSecretId: USERNAME_SECRET,
      passwordSecretId: PASSWORD_SECRET,
    }],
    host: null,
  };
}

describe("station.services.unregister endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;
  let serviceId: string;

  beforeAll(async () => {
    persistence = new Persistence();
    const fs = new FileSystem(persistence.dir);
    await seedStation(fs, STATION_ID);
    const adapter = new StationsAdapter(fs);
    const dispatcher = new StubDispatcher();
    const server = new Server(
      EndpointRegistry.empty(new StubAuthentication())
        .protected(
          new RegisterServiceEndpoint(
            new RegisterServiceHandler(
              adapter,
              new StubBlueprints() as unknown as Blueprints,
              dispatcher,
            ),
          ),
        )
        .protected(
          new UnregisterServiceEndpoint(
            new UnregisterServiceHandler(adapter, dispatcher),
          ),
        ),
      silentLogger,
      "test-core",
    );
    rpc = new Client((request) => server.handle(request));

    await rpc.invoke<StationServicesRegisterResponse>(
      "station.services.register",
      registerReq("docker-host"),
    );
    serviceId = (await persistence.readByName("docker-host")).id;
  });

  afterAll(() => persistence.teardown());

  it("unregisters an existing service from the station", async () => {
    /* @Given a station with a registered service */
    /* @When the service is removed */
    await rpc.invoke<StationServicesUnregisterResponse>("station.services.unregister", {
      sessionId: STUB_SESSION_ID,
      stationId: STATION_ID,
      serviceId,
    });

    /* @Then the station holds no services */
    assertEquals(await persistence.readAll(), []);
  });

  it("rejects when the service does not exist on the station", async () => {
    /* @Given a real station but an unknown service id */
    /* @When removing that service */
    /* @Then it rejects with a service-not-found error */
    await assertRejects(
      () =>
        rpc.invoke<StationServicesUnregisterResponse>("station.services.unregister", {
          sessionId: STUB_SESSION_ID,
          stationId: STATION_ID,
          serviceId: "99999999-9999-9999-9999-999999999999",
        }),
      Exception,
      "service not found",
    );
  });

  it("rejects when the station does not exist", async () => {
    /* @Given an unknown station id */
    /* @When removing a service against it */
    /* @Then it rejects with a station-not-found error */
    await assertRejects(
      () =>
        rpc.invoke<StationServicesUnregisterResponse>("station.services.unregister", {
          sessionId: STUB_SESSION_ID,
          stationId: "00000000-0000-0000-0000-000000000999",
          serviceId,
        }),
      Exception,
      "station not found",
    );
  });
});
