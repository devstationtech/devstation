import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Image } from "@server/images/domain/models/image.ts";
import { Id } from "@server/images/domain/models/id.ts";
import { Name } from "@server/images/domain/models/name.ts";
import { Source } from "@server/images/domain/models/source.ts";
import { Url } from "@server/images/domain/models/url.ts";
import { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";
import { creation } from "@tests/images/fixtures/operations.ts";

describe("Image aggregate", () => {
  it("register builds a v1 catalog entry with name/os/source", () => {
    /* @When an image is registered */
    const image = Image.register(
      new Id(),
      new Name("ubuntu-cloud"),
      OperatingSystem.UBUNTU_22_04,
      new Source(new Url("https://example.com/u.img")),
      creation("alice", "homelab"),
    );
    /* @Then it carries the data at version 1 */
    assertEquals(image.name.value, "ubuntu-cloud");
    assertEquals(image.os, OperatingSystem.UBUNTU_22_04);
    assertEquals(image.source.url.value, "https://example.com/u.img");
    assertEquals(image.version.value, 1);
    assertEquals(image.creation.by.value, "alice");
  });

  it("update replaces name/os/source while preserving id + creation", () => {
    /* @Given a registered image */
    const image = Image.register(
      new Id(),
      new Name("ubuntu-cloud"),
      OperatingSystem.UBUNTU_22_04,
      new Source(new Url("https://example.com/u.img")),
      creation("alice", "homelab"),
    );
    /* @When updated to a new os + source */
    const updated = image.update(
      new Name("debian-cloud"),
      OperatingSystem.DEBIAN_12,
      new Source(new Url("https://example.com/d.img")),
    );
    /* @Then the change is reflected; identity + provenance are kept */
    assertEquals(updated.id.value, image.id.value);
    assertEquals(updated.name.value, "debian-cloud");
    assertEquals(updated.os, OperatingSystem.DEBIAN_12);
    assertEquals(updated.source.url.value, "https://example.com/d.img");
    assertEquals(updated.creation.by.value, "alice");
  });
});
