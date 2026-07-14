import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Station } from "@server/station/domain/models/station.ts";
import { Name } from "@server/station/domain/models/name.ts";
import { Description } from "@server/station/domain/models/description.ts";
import { Status } from "@server/station/domain/models/status.ts";
import { StationRegistered } from "@server/station/domain/events/station-registered.ts";
import { StationUpdated } from "@server/station/domain/events/station-updated.ts";
import { StationUnregistered } from "@server/station/domain/events/station-unregistered.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";

const creation = () => Creation.now(new User("test-user"), new Hostname("test-host"));

function aStation(name = "homelab"): Station {
  return Station.register(new Name(name), new Description("test station"), creation());
}

describe("Station.register", () => {
  it("should produce a station with empty services and REGISTERED status", () => {
    /* @Given valid data */
    const station = aStation();

    /* @Then status REGISTERED (derived: 0 services) and services empty */
    assertEquals(station.status, Status.REGISTERED);
    assertEquals(station.services.length, 0);
  });

  it("should push StationRegistered event", () => {
    /* @Given a registered station */
    const station = aStation("homelab-prod");

    /* @When consuming the events */
    const events = station.events.pull();

    /* @Then the event contains id + name */
    assertEquals(events.length, 1);
    const e = events[0] as StationRegistered;
    assertEquals(e instanceof StationRegistered, true);
    assertEquals(e.name.value, "homelab-prod");
    assertEquals(e.stationId.value, station.id.value);
  });
});

describe("Station.update", () => {
  it("should rename + redescribe and emit StationUpdated", () => {
    /* @Given a registered station */
    const station = aStation();
    station.events.pull();

    /* @When updating */
    station.update(new Name("renamed"), new Description("new description"));

    /* @Then the StationUpdated event was pushed */
    const e = station.events.pull()[0] as StationUpdated;
    assertEquals(e instanceof StationUpdated, true);
    assertEquals(e.name.value, "renamed");
    assertEquals(e.description.value, "new description");
  });

  it("should be a no-op when name and description are unchanged", () => {
    /* @Given a registered station */
    const station = aStation();
    station.events.pull();

    /* @When updating with the same values */
    station.update(new Name("homelab"), new Description("test station"));

    /* @Then there is no event */
    assertEquals(station.events.pull().length, 0);
  });
});

describe("Station.status — derived from services", () => {
  it("empty services → REGISTERED", () => {
    const station = aStation();
    assertEquals(station.status, Status.REGISTERED);
  });

  // Note: scenarios with non-empty services (INSTALLING/INSTALLED/FAILED/ABORTED)
  // are exercised in tests/station/integration/inbound/rpc/install/ since
  // they require running through the orchestration handler. The unit
  // here pins the empty-station baseline; the derivation logic is also
  // covered by tests/station/integration/* via observable side effects.
});

describe("Station.unregister", () => {
  it("should push StationUnregistered regardless of status", () => {
    /* @Given a station */
    const station = aStation();
    station.events.pull();

    /* @When remove */
    station.unregister();

    /* @Then the event was pushed */
    const e = station.events.pull()[0] as StationUnregistered;
    assertEquals(e instanceof StationUnregistered, true);
    assertEquals(e.stationId.value, station.id.value);
  });
});
