import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Station } from "@server/station/domain/models/station.ts";
import { Name } from "@server/station/domain/models/name.ts";
import { Description } from "@server/station/domain/models/description.ts";
import { Id as ServiceId } from "@server/station/domain/models/service/id.ts";
import { Name as ServiceName } from "@server/station/domain/models/service/name.ts";
import { BlueprintName } from "@server/station/domain/models/service/blueprint-name.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import { Secrets } from "@server/station/domain/models/service/secrets.ts";
import { Inputs } from "@server/station/domain/models/service/inputs.ts";
import { Instance } from "@server/station/domain/models/service/instance.ts";
import { Credential } from "@server/shared/building-blocks/domain/models/value-objects/credential.ts";
import { Role } from "@server/station/domain/models/service/role.ts";
import { Installation } from "@server/station/domain/models/service/installation.ts";
import { InstallResult } from "@server/station/domain/models/service/install-result.ts";
import { ServiceInstallSucceeded } from "@server/station/domain/events/service-install-succeeded.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";

const creation = () => Creation.now(new User("test-user"), new Hostname("test-host"));

function stationWithService(): { station: Station; serviceId: ServiceId } {
  const station = Station.register(new Name("homelab"), new Description("test"), creation());
  const serviceId = new ServiceId();
  station.addService(
    serviceId,
    new ServiceName("k3s"),
    new BlueprintName("k3s"),
    new Vault(),
    new Inputs({}),
    new Secrets({}),
    [
      new Instance(
        new Role("server"),
        "10.0.0.1",
        new Credential(new Vault(), new Secret(), new Secret()),
      ),
    ],
    null,
    creation(),
  );
  station.events.pull();
  return { station, serviceId };
}

/**
 * Published install secrets must never live in aggregate state (and
 * therefore never reach stations.json). The vault listener is the only
 * durable consumer of the values, fed by the ServiceInstallSucceeded event.
 */
describe("Station.installService — secret hygiene", () => {
  it("stores sanitized installations but emits the full result on the event", () => {
    /* @Given a station with a installing service */
    const { station, serviceId } = stationWithService();
    station.startServiceInstall(serviceId);
    station.events.pull();

    /* @When the install completes with a published secret */
    const installations = [
      new Installation(
        new Role("server"),
        "10.0.0.1",
        new InstallResult({ version: "1.0.0" }, { token: "super-secret-token" }, {
          ip: "10.0.0.1",
        }),
        new Instant(),
      ),
    ];
    station.installService(serviceId, installations);

    /* @Then the event carries the secret value (the vault listener needs it) */
    const event = station.events.pull().find((e) =>
      e instanceof ServiceInstallSucceeded
    ) as ServiceInstallSucceeded;
    assertEquals(event.installations[0].result.secrets.token, "super-secret-token");

    /* @And the aggregate keeps no secret values — outputs survive intact */
    const stored = station.services[0].installations[0];
    assertEquals(stored.result.secrets, {});
    assertEquals(stored.result.outputs, { ip: "10.0.0.1" });
    assertEquals(stored.result.blueprint.version, "1.0.0");
  });
});

describe("InstallResult.sanitized", () => {
  it("drops secret values and keeps identity + outputs", () => {
    /* @Given a result with secrets and outputs */
    const result = new InstallResult({ version: "2.1.0" }, { a: "v1", b: "v2" }, {
      url: "http://x",
    });

    /* @When sanitized */
    const clean = result.sanitized();

    /* @Then secrets are gone, the rest is intact, the original is untouched */
    assertEquals(clean.secrets, {});
    assertEquals(clean.outputs, { url: "http://x" });
    assertEquals(clean.blueprint.version, "2.1.0");
    assertEquals(result.secrets, { a: "v1", b: "v2" });
  });
});
