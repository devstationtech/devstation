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
  StationInstallResponse,
  StationServicesRegisterResponse,
  StationUninstallResponse,
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
import { InstallStationHandler } from "@server/station/application/handlers/install-station-handler.ts";
import { UninstallStationHandler } from "@server/station/application/handlers/uninstall-station-handler.ts";
import { ActiveInstalls } from "@server/station/application/services/active-installs.ts";
import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";
import {
  InstallStationEndpoint,
  RegisterServiceEndpoint,
  UninstallStationEndpoint,
} from "@server/station/inbound/rpc/endpoints.ts";
import { InMemoryExecutions } from "@server/shared/executions/outbound/in-memory-executions.ts";
import type { Installer } from "@server/station/domain/ports/outbound/installer.ts";
import type { SecretResolver } from "@server/shared/secrets/domain/ports/outbound/secret-resolver.ts";
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

const stubResolver: SecretResolver = {
  resolve: () => Promise.resolve("stub-value"),
};

const stubInstaller: Installer = {
  install: () => ({ run: () => Promise.resolve([]) }),
  uninstall: () => ({ run: () => Promise.resolve() }),
};

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("station.install endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;
  let serviceId: string;
  let executions: Executions;

  beforeAll(async () => {
    persistence = new Persistence();
    const fs = new FileSystem(persistence.dir);
    await seedStation(fs, STATION_ID);
    const adapter = new StationsAdapter(fs);
    const dispatcher = new StubDispatcher();
    const blueprints = new StubBlueprints() as unknown as Blueprints;
    executions = new InMemoryExecutions();
    const activeInstalls = new ActiveInstalls();

    const server = new Server(
      EndpointRegistry.empty(new StubAuthentication())
        .protected(
          new RegisterServiceEndpoint(
            new RegisterServiceHandler(adapter, blueprints, dispatcher),
          ),
        )
        .protected(
          new InstallStationEndpoint(
            new InstallStationHandler(
              adapter,
              blueprints,
              stubResolver,
              stubInstaller,
              executions,
              dispatcher,
              activeInstalls,
            ),
          ),
        )
        .protected(
          new UninstallStationEndpoint(
            new UninstallStationHandler(
              adapter,
              blueprints,
              stubResolver,
              stubInstaller,
              executions,
              dispatcher,
              activeInstalls,
            ),
          ),
        ),
      silentLogger,
      "test-core",
    );
    rpc = new Client((request) => server.handle(request));

    await rpc.invoke<StationServicesRegisterResponse>(
      "station.services.register",
      {
        sessionId: STUB_SESSION_ID,
        stationId: STATION_ID,
        name: "docker-host",
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
      },
    );
    serviceId = (await persistence.readByName("docker-host")).id;
  });

  afterAll(() => persistence.teardown());

  it("returns an executionId for the install session", async () => {
    /* @Given a station with a registered service */
    /* @When the service is installed */
    const response = await rpc.invoke<StationInstallResponse>("station.install", {
      sessionId: STUB_SESSION_ID,
      stationId: STATION_ID,
      serviceIds: [serviceId],
    });

    /* @Then a UUID executionId for the install session is returned */
    assertEquals(typeof response.executionId, "string");
    assertEquals(UUID_RE.test(response.executionId), true);

    // Drain the execution stream so async FS writes triggered by the
    // orchestrator (saving the station with the new service state) finish
    // before teardown.
    for await (const _ of executions.of(response.executionId).watch()) {
      // consume until terminal event closes the stream
    }
  });

  it("station.uninstall returns an executionId for the teardown session", async () => {
    /* @Given a installed service */
    const install = await rpc.invoke<StationInstallResponse>("station.install", {
      sessionId: STUB_SESSION_ID,
      stationId: STATION_ID,
      serviceIds: [serviceId],
    });
    for await (const _ of executions.of(install.executionId).watch()) { /* drain */ }

    /* @When the service is torn down */
    const response = await rpc.invoke<StationUninstallResponse>("station.uninstall", {
      sessionId: STUB_SESSION_ID,
      stationId: STATION_ID,
      serviceIds: [serviceId],
    });

    /* @Then a UUID executionId for the teardown session is returned */
    assertEquals(typeof response.executionId, "string");
    assertEquals(UUID_RE.test(response.executionId), true);

    for await (const _ of executions.of(response.executionId).watch()) { /* drain */ }
  });
});
