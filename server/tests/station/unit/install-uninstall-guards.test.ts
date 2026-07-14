import { assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { InstallStationHandler } from "@server/station/application/handlers/install-station-handler.ts";
import { UninstallStationHandler } from "@server/station/application/handlers/uninstall-station-handler.ts";
import { InstallStation } from "@server/station/application/commands/install-station.ts";
import { UninstallStation } from "@server/station/application/commands/uninstall-station.ts";
import { ActiveInstalls } from "@server/station/application/services/active-installs.ts";
import { Station } from "@server/station/domain/models/station.ts";
import { Id as StationId } from "@server/station/domain/models/id.ts";
import { Name as StationName } from "@server/station/domain/models/name.ts";
import { Description } from "@server/station/domain/models/description.ts";
import { Service } from "@server/station/domain/models/service/service.ts";
import { Id } from "@server/station/domain/models/service/id.ts";
import { Name } from "@server/station/domain/models/service/name.ts";
import { BlueprintName } from "@server/station/domain/models/service/blueprint-name.ts";
import { Status } from "@server/station/domain/models/service/status.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import { Secrets } from "@server/station/domain/models/service/secrets.ts";
import { Inputs } from "@server/station/domain/models/service/inputs.ts";
import { Instance } from "@server/station/domain/models/service/instance.ts";
import { Credential } from "@server/shared/building-blocks/domain/models/value-objects/credential.ts";
import { Role } from "@server/station/domain/models/service/role.ts";
import { Host } from "@server/station/domain/models/service/host.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import type { Stations } from "@server/station/domain/ports/outbound/stations.ts";
import type { Blueprints } from "@server/station/domain/ports/outbound/blueprints.ts";
import type { Installer } from "@server/station/domain/ports/outbound/installer.ts";
import type { SecretResolver } from "@server/shared/secrets/domain/ports/outbound/secret-resolver.ts";
import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";
import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";

/**
 * The install/uninstall handlers guard the host-dependency closure BEFORE any
 * execution starts: you cannot install a hosted service whose host is absent
 * or not yet INSTALLED, and you cannot tear down a host while an INSTALLED
 * dependent still rides on it. These rejections are pure domain reasoning —
 * pinned here without a runtime. The collaborators below throw if reached,
 * proving the guard short-circuits before the installer/executions are touched.
 */

const creation = () => Creation.now(new User("u"), new Hostname("h"));
const STATION_ID = "44444444-4444-4444-4444-444444444444";

function standalone(name: string, status: Status = Status.REGISTERED): Service {
  return new Service(
    new Id(),
    new Name(name),
    new BlueprintName("docker"),
    new Vault(),
    new Inputs({}),
    new Secrets({}),
    [
      new Instance(
        new Role("main"),
        "10.0.0.1",
        new Credential(new Vault(), new Secret(), new Secret()),
      ),
    ],
    null,
    creation(),
    status,
  );
}

function hostedOn(name: string, hostServiceId: Id, status: Status = Status.REGISTERED): Service {
  return new Service(
    new Id(),
    new Name(name),
    new BlueprintName("argocd"),
    new Vault(),
    new Inputs({}),
    new Secrets({}),
    [],
    new Host(hostServiceId, "main"),
    creation(),
    status,
  );
}

function stationWith(services: Service[]): Station {
  return new Station(
    new StationId(STATION_ID),
    new StationName("s"),
    new Description("d"),
    creation(),
    services,
  );
}

/** Stations port that only answers `of`; every other method is a landmine. */
function fakeStations(station: Station): Stations {
  const nope = () => {
    throw new Error("Stations method must not be reached on the guard path");
  };
  return {
    of: (_id) => Promise.resolve(station),
    byName: nope as unknown as Stations["byName"],
    add: nope as unknown as Stations["add"],
    save: nope as unknown as Stations["save"],
    update: nope as unknown as Stations["update"],
    remove: nope as unknown as Stations["remove"],
  };
}

// Collaborators that must never be invoked once a guard rejects.
const unreachableBlueprints = {
  of: () => Promise.reject(new Error("blueprints.of must not be reached")),
  contains: () => Promise.reject(new Error("unreached")),
  list: () => Promise.reject(new Error("unreached")),
} as unknown as Blueprints;
const unreachableResolver: SecretResolver = {
  resolve: () => Promise.reject(new Error("secretResolver must not be reached")),
};
const unreachableInstaller = {
  install: () => {
    throw new Error("installer must not be reached");
  },
  uninstall: () => {
    throw new Error("installer must not be reached");
  },
} as unknown as Installer;
const unreachableExecutions = {
  start: () => {
    throw new Error("executions.start must not be reached on the guard path");
  },
  of: () => {
    throw new Error("unreached");
  },
} as unknown as Executions;
const noopDispatcher: Dispatcher = { dispatch: () => Promise.resolve() };

function installHandler(station: Station): InstallStationHandler {
  return new InstallStationHandler(
    fakeStations(station),
    unreachableBlueprints,
    unreachableResolver,
    unreachableInstaller,
    unreachableExecutions,
    noopDispatcher,
    new ActiveInstalls(),
  );
}
function uninstallHandler(station: Station): UninstallStationHandler {
  return new UninstallStationHandler(
    fakeStations(station),
    unreachableBlueprints,
    unreachableResolver,
    unreachableInstaller,
    unreachableExecutions,
    noopDispatcher,
    new ActiveInstalls(),
  );
}

describe("InstallStationHandler — dependency closure guard", () => {
  it("rejects installing a hosted service whose host is not in the station", async () => {
    /* @Given a hosted service pinned to a host id that no service in the station carries */
    const orphan = hostedOn("argocd", new Id());
    const station = stationWith([orphan]);
    /* @When installing just that service @Then it is refused as referencing an absent host */
    await assertRejects(
      () => installHandler(station).handle(new InstallStation(STATION_ID, [orphan.id.value])),
      Error,
      "not in this station",
    );
  });

  it("rejects installing a hosted service whose host is present but not INSTALLED", async () => {
    /* @Given a host still REGISTERED and a service hosted on it */
    const host = standalone("k3s", Status.REGISTERED);
    const dependent = hostedOn("argocd", host.id, Status.REGISTERED);
    const station = stationWith([host, dependent]);
    /* @When installing only the dependent (host not in the selection) */
    /* @Then it is refused — the host must be installed or co-selected */
    await assertRejects(
      () => installHandler(station).handle(new InstallStation(STATION_ID, [dependent.id.value])),
      Error,
      "not INSTALLED yet",
    );
  });
});

describe("UninstallStationHandler — reverse closure guard", () => {
  it("rejects uninstalling a host while an INSTALLED dependent still rides on it", async () => {
    /* @Given an INSTALLED host with an INSTALLED hosted dependent */
    const host = standalone("k3s", Status.INSTALLED);
    const dependent = hostedOn("argocd", host.id, Status.INSTALLED);
    const station = stationWith([host, dependent]);
    /* @When uninstalling only the host @Then it is refused to avoid orphaning the dependent */
    await assertRejects(
      () => uninstallHandler(station).handle(new UninstallStation(STATION_ID, [host.id.value])),
      Error,
      "still installed",
    );
  });
});
