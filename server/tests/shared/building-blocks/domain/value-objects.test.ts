import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Slug } from "@server/shared/building-blocks/domain/models/value-objects/slug.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Integer } from "@server/shared/building-blocks/domain/models/value-objects/integer.ts";
import { Version } from "@server/shared/building-blocks/domain/models/value-objects/version.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { Uuid } from "@server/shared/building-blocks/domain/models/value-objects/uuid.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";

/**
 * Foundational value objects every BC builds on. Each test pins the
 * exact validation rule so a regression at this layer (one wrong
 * regex, one off-by-one) shows up here, not three layers up.
 */

describe("Slug", () => {
  it("accepts lowercase letters, digits, and hyphens", () => {
    /* @When Slug is built with allowed characters */
    /* @Then no error is thrown and the value is exposed verbatim */
    assertEquals(new Slug("docker").value, "docker");
    assertEquals(new Slug("k3s-server").value, "k3s-server");
    assertEquals(new Slug("a1b2").value, "a1b2");
  });

  it("accepts the single-character edge case", () => {
    /* @Given the regex's single-char branch must be exercised */
    assertEquals(new Slug("a").value, "a");
  });

  it("rejects empty input", () => {
    assertThrows(() => new Slug(""), Error, "required");
  });

  it("rejects more than 64 characters", () => {
    assertThrows(() => new Slug("a".repeat(65)), Error, "64");
  });

  it("rejects uppercase letters (slugs are lowercase-only)", () => {
    assertThrows(() => new Slug("Docker"), Error, "lowercase");
  });

  it("rejects underscores and spaces (hyphens only)", () => {
    assertThrows(() => new Slug("my_slug"), Error);
    assertThrows(() => new Slug("my slug"), Error);
  });

  it("rejects leading or trailing hyphens (must start and end with alphanumeric)", () => {
    assertThrows(() => new Slug("-docker"), Error);
    assertThrows(() => new Slug("docker-"), Error);
  });
});

describe("Hostname", () => {
  it("accepts non-empty hostnames without whitespace", () => {
    assertEquals(new Hostname("workstation").value, "workstation");
    assertEquals(new Hostname("dev-laptop-01").value, "dev-laptop-01");
  });

  it("rejects empty input", () => {
    assertThrows(() => new Hostname(""), Error, "required");
  });

  it("rejects whitespace and control characters (newline, tab, space, CR)", () => {
    /* @Given a hostname containing any whitespace or control character */
    /* @When Hostname is constructed */
    /* @Then it throws — these break ssh + DNS contexts */
    for (const v of ["host name", "host\tname", "host\nname", "host\rname"]) {
      assertThrows(() => new Hostname(v), Error, "whitespace");
    }
  });
});

describe("Integer", () => {
  it("accepts positive integers", () => {
    assertEquals(new Integer(1).value, 1);
    assertEquals(new Integer(42).value, 42);
  });

  it("rejects zero, negatives, and non-integers", () => {
    for (const v of [0, -1, 1.5, NaN, Infinity]) {
      assertThrows(() => new Integer(v), Error, "positive integer");
    }
  });
});

describe("Version", () => {
  it("starts at 1 and increments via next()", () => {
    /* @Given a fresh Version(1) */
    const v = new Version(1);
    /* @When next() is called twice */
    const v2 = v.next();
    const v3 = v2.next();
    /* @Then the underlying counter advances; original is immutable */
    assertEquals(v.value, 1);
    assertEquals(v2.value, 2);
    assertEquals(v3.value, 3);
  });

  it("rejects values <= 0 (inherits Integer rule)", () => {
    assertThrows(() => new Version(0), Error);
  });
});

describe("Instant", () => {
  it("defaults to now() when constructed without arguments", () => {
    /* @When Instant() is constructed without args */
    const before = Date.now();
    const i = new Instant();
    const after = Date.now();
    /* @Then the captured Date is within the surrounding wall-clock window */
    assertEquals(i.date.getTime() >= before, true);
    assertEquals(i.date.getTime() <= after, true);
  });

  it("rejects an invalid Date (NaN getTime)", () => {
    /* @Given new Date("not a date") yields a NaN-time Date */
    assertThrows(() => new Instant(new Date("not a date")), Error, "invalid instant");
  });

  it("round-trips through toString() / fromString()", () => {
    /* @Given a specific ISO string */
    const iso = "2026-05-20T10:20:30.000Z";
    /* @When fromString → toString */
    const round = Instant.fromString(iso).toString();
    /* @Then the same ISO is produced */
    assertEquals(round, iso);
  });
});

describe("Uuid", () => {
  it("auto-generates a v4 UUID when no value is given", () => {
    /* @Given Uuid is constructed without args */
    const u = new Uuid();
    /* @Then the value matches the v4 UUID format */
    assertEquals(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(u.value),
      true,
    );
  });

  it("preserves the provided value verbatim when given one", () => {
    const id = "deadbeef-1234-5678-9abc-def012345678";
    assertEquals(new Uuid(id).value, id);
  });

  it("generates distinct values across constructions (collision resistance)", () => {
    const a = new Uuid().value;
    const b = new Uuid().value;
    assertEquals(a === b, false);
  });
});

describe("Creation", () => {
  it("captures by + hostname + at on construction", () => {
    /* @Given a known user/host/instant */
    const by = new User("alice");
    const host = new Hostname("workstation");
    const at = Instant.fromString("2026-01-01T00:00:00.000Z");
    /* @When Creation is constructed */
    const c = new Creation(by, host, at);
    /* @Then fields are exposed verbatim */
    assertEquals(c.by, by);
    assertEquals(c.hostname, host);
    assertEquals(c.at, at);
  });

  it("Creation.now() stamps the moment automatically", () => {
    /* @When Creation.now(by, host) is called */
    const before = Date.now();
    const c = Creation.now(new User("alice"), new Hostname("workstation"));
    const after = Date.now();
    /* @Then the at field is within the wall-clock window */
    assertEquals(c.at.date.getTime() >= before, true);
    assertEquals(c.at.date.getTime() <= after, true);
  });
});

describe("OperatingSystem", () => {
  it("from() builds the model from a supported value", () => {
    /* @When a supported OS string is built into the VO */
    /* @Then it round-trips to the matching enum member */
    assertEquals(OperatingSystem.from("ubuntu-22-04"), OperatingSystem.UBUNTU_22_04);
    assertEquals(OperatingSystem.from("ubuntu-24-04"), OperatingSystem.UBUNTU_24_04);
    assertEquals(OperatingSystem.from("debian-12"), OperatingSystem.DEBIAN_12);
  });

  it("from() throws on an unsupported value (validation lives in the model)", () => {
    /* @When an unknown OS string is built */
    /* @Then the VO refuses it — no separate parse helper is needed */
    assertThrows(() => OperatingSystem.from("windows-11"), Error, "unsupported operating system");
    assertThrows(() => OperatingSystem.from(""), Error, "unsupported operating system");
  });

  it("values() exposes only the supported members (not the merged helpers)", () => {
    /* @Then the enumerated set is exactly the three OS strings */
    assertEquals([...OperatingSystem.values()], [
      "ubuntu-22-04",
      "ubuntu-24-04",
      "debian-12",
      "debian-13",
    ]);
  });
});
