import { Container } from "@server/container.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Adapter as StationsAdapter } from "@server/station/outbound/persistence/file-system/adapter.ts";
import { Station } from "@server/station/domain/models/station.ts";
import { Id as StationId } from "@server/station/domain/models/id.ts";
import { Name as StationName } from "@server/station/domain/models/name.ts";
import { Description as StationDescription } from "@server/station/domain/models/description.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Persistence } from "@tests/station/integration/outbound/services-persistence.ts";
import { TestEventBus } from "@tests/shared/fixtures/event-bus.ts";

/**
 * Pre-seeds a station so service-related action tests have a real station
 * to operate on. Use the returned stationId as the station id in subsequent
 * action requests.
 */
export async function seedStation(
  fs: FileSystem,
  stationId: string,
  name = "test-station",
): Promise<void> {
  const adapter = new StationsAdapter(fs);
  const station = new Station(
    new StationId(stationId),
    new StationName(name),
    new StationDescription(`${name} description`),
    Creation.now(new User("seed-user"), new Hostname("seed-host")),
  );
  await adapter.add(station);
}

/**
 * Test container with persistence + bus + station adapter wired in. Tests
 * that need handlers/actions register them on top of this base via
 * `.register(...)` on the returned container.
 */
export function baseContainer(): Container {
  return new Container()
    .register(Persistence, () => new Persistence())
    .register(FileSystem, (c) => new FileSystem(c.get(Persistence).dir))
    .register(TestEventBus, () => new TestEventBus())
    .register(StationsAdapter, (c) => new StationsAdapter(c.get(FileSystem)));
}
