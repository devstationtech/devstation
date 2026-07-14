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
import { RegisterServiceEndpoint } from "@server/station/inbound/rpc/endpoints.ts";
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

function newRequest(name: string): StationServicesRegisterRequest {
  return {
    sessionId: STUB_SESSION_ID,
    stationId: STATION_ID,
    name,
    blueprint: "docker",
    vaultId: VAULT_ID,
    inputs: { port: 5432 },
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

describe("station.services.register endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeAll(async () => {
    persistence = new Persistence();
    const fs = new FileSystem(persistence.dir);
    await seedStation(fs, STATION_ID);
    const adapter = new StationsAdapter(fs);
    const handler = new RegisterServiceHandler(
      adapter,
      new StubBlueprints() as unknown as Blueprints,
      new StubDispatcher(),
    );
    const endpoint = new RegisterServiceEndpoint(handler);
    const server = new Server(
      EndpointRegistry.empty(new StubAuthentication()).protected(endpoint),
      silentLogger,
      "test-core",
    );
    rpc = new Client((request) => server.handle(request));
  });

  afterAll(() => persistence.teardown());

  it("registers a service inside the station with one instance", async () => {
    /* @Given a seeded station and a service request with one instance */
    /* @When the service is registered */
    await rpc.invoke<StationServicesRegisterResponse>(
      "station.services.register",
      newRequest("docker-host"),
    );

    /* @Then it is persisted under the station with its instance */
    const record = await persistence.readByName("docker-host");
    assertEquals(record.status, "REGISTERED");
    assertEquals(record.stationId, STATION_ID);
    assertEquals(record.instances.length, 1);
    assertEquals(record.instances[0].host, "10.0.0.1");
    assertEquals(record.instances[0].role, "main");
  });

  it("rejects a duplicate service name within the same station", async () => {
    /* @Given a service "nginx" already registered on the station */
    await rpc.invoke<StationServicesRegisterResponse>(
      "station.services.register",
      newRequest("nginx"),
    );

    /* @When registering another "nginx" on the same station */
    /* @Then it rejects with an already-exists error */
    await assertRejects(
      () =>
        rpc.invoke<StationServicesRegisterResponse>(
          "station.services.register",
          newRequest("nginx"),
        ),
      Exception,
      "already exists",
    );
  });
});
