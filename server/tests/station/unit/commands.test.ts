import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  type InstanceData,
  RegisterService,
} from "@server/station/application/commands/register-service.ts";
import { InstallStation } from "@server/station/application/commands/install-station.ts";

/**
 * Station application commands — primitive-carrying DTOs whose
 * constructors enforce the cross-field invariants the handler relies
 * on. Pins the mutually-exclusive standalone/hosted choice of
 * `RegisterService` and the non-empty-selection rule of `InstallStation`.
 */

const STATION_ID = "00000000-0000-0000-0000-000000000001";

const anInstance: InstanceData = {
  role: "main",
  host: "10.0.0.5",
  credentialVaultId: "00000000-0000-0000-0000-0000000000a0",
  usernameSecretId: "00000000-0000-0000-0000-0000000000a1",
  passwordSecretId: "00000000-0000-0000-0000-0000000000a2",
};

function registerWith(
  instances: InstanceData[] | null,
  host: { serviceId: string; role: string } | null,
): RegisterService {
  return new RegisterService(
    STATION_ID,
    "my-service",
    "k3s",
    "00000000-0000-0000-0000-0000000000b0",
    {},
    {},
    "alice",
    "workstation",
    instances,
    host,
  );
}

describe("RegisterService", () => {
  it("accepts the standalone shape (instances, no host)", () => {
    /* @Given a service placed on its own VMs */
    const cmd = registerWith([anInstance], null);
    /* @Then the command holds the instances and no host */
    assertEquals(cmd.instances?.length, 1);
    assertEquals(cmd.host, null);
  });

  it("accepts the hosted shape (host, no instances)", () => {
    /* @Given a service co-located on another service's VMs */
    const cmd = registerWith(null, { serviceId: "svc-host", role: "server" });
    assertEquals(cmd.instances, null);
    assertEquals(cmd.host?.role, "server");
  });

  it("rejects providing BOTH instances and host (ambiguous placement)", () => {
    /* @Given both placement shapes supplied */
    /* @When RegisterService is constructed */
    /* @Then it throws — a service is either standalone or hosted, never both */
    assertThrows(
      () => registerWith([anInstance], { serviceId: "svc-host", role: "server" }),
      Error,
      "not both",
    );
  });

  it("rejects providing NEITHER instances nor host (no placement)", () => {
    /* @Given no placement shape at all */
    /* @When RegisterService is constructed */
    /* @Then it throws — the handler needs somewhere to install */
    assertThrows(() => registerWith(null, null), Error, "either instances");
  });

  it("treats an empty instances array as 'no instances' (falls into the neither-branch)", () => {
    /* @Given instances=[] (empty) and no host */
    /* @When RegisterService is constructed */
    /* @Then it throws — an empty array is not a valid standalone placement */
    assertThrows(() => registerWith([], null), Error, "either instances");
  });

  it("stationDomainId() wraps the raw id into the domain Id VO", () => {
    const cmd = registerWith([anInstance], null);
    assertEquals(cmd.stationDomainId().value, STATION_ID);
  });
});

describe("InstallStation", () => {
  it("carries the station id and the chosen service-id selection", () => {
    /* @Given a two-service rollout */
    const cmd = new InstallStation(STATION_ID, ["svc-1", "svc-2"]);
    assertEquals(cmd.stationId, STATION_ID);
    assertEquals([...cmd.serviceIds], ["svc-1", "svc-2"]);
  });

  it("rejects an empty service selection (nothing to install)", () => {
    /* @Given an empty serviceIds list */
    /* @When InstallStation is constructed */
    /* @Then it throws — a install session must target at least one service */
    assertThrows(() => new InstallStation(STATION_ID, []), Error, "non-empty");
  });

  it("stationDomainId() wraps the raw station id into the domain Id VO", () => {
    const cmd = new InstallStation(STATION_ID, ["svc-1"]);
    assertEquals(cmd.stationDomainId().value, STATION_ID);
  });

  it("serviceDomainIds() maps every raw id into a domain ServiceId VO", () => {
    /* @Given a selection of two service ids */
    const cmd = new InstallStation(STATION_ID, ["svc-1", "svc-2"]);
    /* @When serviceDomainIds() runs */
    const ids = cmd.serviceDomainIds();
    /* @Then one VO per id, value-preserving, order-preserving */
    assertEquals(ids.length, 2);
    assertEquals(ids.map((i) => i.value), ["svc-1", "svc-2"]);
  });
});
