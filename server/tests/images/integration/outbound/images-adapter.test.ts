import { assertEquals, assertRejects } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Adapter } from "@server/images/outbound/persistence/file-system/adapter.ts";
import { Image } from "@server/images/domain/models/image.ts";
import { Id } from "@server/images/domain/models/id.ts";
import { Name } from "@server/images/domain/models/name.ts";
import { Source } from "@server/images/domain/models/source.ts";
import { Url } from "@server/images/domain/models/url.ts";
import { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { ImageNotFound } from "@server/images/domain/exceptions/image-not-found.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";

/**
 * Image catalog file-system persistence Adapter — the `Images` outbound port
 * over `images.json`. Pins the CRUD contract (of/add/update/remove/exists)
 * and the serialize ⇄ unserialize round-trip.
 */
// deno-lint-ignore no-explicit-any
const NO_OP_LOGGER = {
  info: () => Promise.resolve(),
  error: () => Promise.resolve(),
} as any as Logger;

function ubuntu(name = "ubuntu-cloud"): Image {
  return Image.register(
    new Id(),
    new Name(name),
    OperatingSystem.UBUNTU_22_04,
    new Source(new Url("https://example.com/ubuntu-22.04.img")),
    new Creation(new User("tester"), new Hostname("test-host"), new Instant()),
  );
}

describe("image catalog persistence Adapter", () => {
  let dir: string;
  let adapter: Adapter;

  beforeEach(() => {
    dir = Deno.makeTempDirSync({ prefix: "images-adapter-" });
    adapter = new Adapter(new FileSystem(dir), NO_OP_LOGGER);
  });

  afterEach(() => Deno.remove(dir, { recursive: true }));

  it("add then of round-trips an Image through serialize ⇄ unserialize", async () => {
    /* @Given a registered image */
    const image = ubuntu();
    /* @When added and fetched by id */
    await adapter.add(image);
    const loaded = await adapter.of(image.id);
    /* @Then the deserialized aggregate is equivalent */
    assertEquals(loaded.id.value, image.id.value);
    assertEquals(loaded.name.value, "ubuntu-cloud");
    assertEquals(loaded.os, OperatingSystem.UBUNTU_22_04);
    assertEquals(loaded.source.url.value, "https://example.com/ubuntu-22.04.img");
  });

  it("exists reports by name", async () => {
    const image = ubuntu("debian-net");
    assertEquals(await adapter.exists(new Name("debian-net")), false);
    await adapter.add(image);
    assertEquals(await adapter.exists(new Name("debian-net")), true);
  });

  it("update replaces the entry", async () => {
    /* @Given a stored image */
    const image = ubuntu();
    await adapter.add(image);
    /* @When updated to a new os + source */
    const updated = image.update(
      image.name,
      OperatingSystem.DEBIAN_12,
      new Source(new Url("https://example.com/debian-12.img")),
    );
    await adapter.update(updated);
    /* @Then the change is persisted */
    const loaded = await adapter.of(image.id);
    assertEquals(loaded.os, OperatingSystem.DEBIAN_12);
    assertEquals(loaded.source.url.value, "https://example.com/debian-12.img");
  });

  it("remove deletes; of and update on a missing id throw ImageNotFound", async () => {
    const image = ubuntu();
    await adapter.add(image);
    await adapter.remove(image.id);
    await assertRejects(() => adapter.of(image.id), ImageNotFound);
    await assertRejects(() => adapter.remove(image.id), ImageNotFound);
  });
});
