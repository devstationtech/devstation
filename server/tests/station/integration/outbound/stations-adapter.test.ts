import { assertEquals, assertRejects } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Adapter } from "@server/station/outbound/persistence/file-system/adapter.ts";
import { Station } from "@server/station/domain/models/station.ts";
import { Id } from "@server/station/domain/models/id.ts";
import { Name } from "@server/station/domain/models/name.ts";
import { Description } from "@server/station/domain/models/description.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { StationNotFound } from "@server/station/domain/exceptions/station-not-found.ts";

/**
 * Station file-system persistence Adapter — the `Stations` outbound
 * port over the consolidated `stations.json`. Pins the CRUD contract
 * (add/of/byName/save/remove), the round-trip through serialize ⇄
 * deserialize, and every not-found / duplicate guard.
 */

function aStation(opts: { id?: string; name?: string; description?: string } = {}): Station {
  return new Station(
    new Id(opts.id),
    new Name(opts.name ?? "homelab"),
    new Description(opts.description ?? "dev station"),
    new Creation(
      new User("alice"),
      new Hostname("workstation"),
      Instant.fromString("2026-01-01T00:00:00.000Z"),
    ),
  );
}

describe("station persistence Adapter", () => {
  let dir: string;
  let adapter: Adapter;

  beforeEach(() => {
    dir = Deno.makeTempDirSync({ prefix: "stations-adapter-" });
    adapter = new Adapter(new FileSystem(dir));
  });

  afterEach(() => Deno.remove(dir, { recursive: true }));

  it("add then of round-trips the station through serialize ⇄ deserialize", async () => {
    /* @Given a fresh station */
    const station = aStation({ name: "homelab" });
    /* @When added and fetched back by id */
    await adapter.add(station);
    const loaded = await adapter.of(station.id);
    /* @Then the deserialized aggregate carries the same identity + fields */
    assertEquals(loaded.id.value, station.id.value);
    assertEquals(loaded.name.value, "homelab");
    assertEquals(loaded.description.value, "dev station");
    assertEquals(loaded.creation.by.value, "alice");
  });

  it("byName returns the matching station, or null when absent", async () => {
    /* @Given one persisted station */
    const station = aStation({ name: "homelab" });
    await adapter.add(station);
    /* @Then byName resolves it, and a miss returns null (not a throw) */
    const found = await adapter.byName(new Name("homelab"));
    assertEquals(found?.id.value, station.id.value);
    assertEquals(await adapter.byName(new Name("ghost")), null);
  });

  it("of throws StationNotFound for an unknown id", async () => {
    await assertRejects(() => adapter.of(new Id()), StationNotFound);
  });

  it("add rejects a duplicate id", async () => {
    /* @Given a station already persisted */
    const station = aStation();
    await adapter.add(station);
    /* @When the same id is added again */
    /* @Then it throws — the id is the aggregate's unique key */
    await assertRejects(() => adapter.add(station), Error, "already exists");
  });

  it("save replaces an existing station (and bumps what the aggregate carries)", async () => {
    /* @Given a persisted station */
    const station = aStation({ name: "homelab", description: "v1" });
    await adapter.add(station);
    /* @When a station with the same id but new description is saved */
    const renamed = new Station(
      station.id,
      new Name("homelab"),
      new Description("v2 — edited"),
      station.creation,
    );
    await adapter.save(renamed);
    /* @Then the persisted copy reflects the edit */
    const loaded = await adapter.of(station.id);
    assertEquals(loaded.description.value, "v2 — edited");
  });

  it("save throws StationNotFound when the station was never added", async () => {
    await assertRejects(() => adapter.save(aStation()), StationNotFound);
  });

  it("remove deletes the station; a subsequent of throws", async () => {
    /* @Given a persisted station */
    const station = aStation();
    await adapter.add(station);
    /* @When removed */
    await adapter.remove(station.id);
    /* @Then it's gone */
    await assertRejects(() => adapter.of(station.id), StationNotFound);
  });

  it("remove throws StationNotFound for an unknown id", async () => {
    await assertRejects(() => adapter.remove(new Id()), StationNotFound);
  });

  it("keeps multiple stations independent across add/remove", async () => {
    /* @Given two stations persisted */
    const a = aStation({ name: "alpha" });
    const b = aStation({ name: "beta" });
    await adapter.add(a);
    await adapter.add(b);
    /* @When one is removed */
    await adapter.remove(a.id);
    /* @Then the other survives untouched */
    assertEquals((await adapter.of(b.id)).name.value, "beta");
    await assertRejects(() => adapter.of(a.id), StationNotFound);
  });
});
