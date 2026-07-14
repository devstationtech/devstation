import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { compareSemver, currentTarget, Version } from "@ui/self-update/version.ts";

describe("compareSemver", () => {
  it("orders by major, then minor, then patch", () => {
    /* @Then comparison cascades major → minor → patch */
    assertEquals(compareSemver("1.0.0", "2.0.0"), -1);
    assertEquals(compareSemver("1.2.0", "1.3.0"), -1);
    assertEquals(compareSemver("1.2.3", "1.2.4"), -1);
    assertEquals(compareSemver("2.0.0", "1.9.9"), 1);
    assertEquals(compareSemver("1.2.3", "1.2.3"), 0);
  });

  it("tolerates a leading v", () => {
    /* @Then a leading v is ignored */
    assertEquals(compareSemver("v1.2.3", "1.2.3"), 0);
    assertEquals(compareSemver("v1.2.4", "v1.2.3"), 1);
  });

  it("sorts unparseable inputs as older", () => {
    /* @Then unparseable inputs sort as older */
    assertEquals(compareSemver("dev", "0.1.0"), -1);
    assertEquals(compareSemver("0.1.0", "dev"), 1);
    assertEquals(compareSemver("garbage", "nope"), 0);
  });
});

describe("Version.isDev", () => {
  it("flags 0.0.0 family + dev/empty + pre-release", () => {
    /* @Then 0.0.0 family, dev/empty, and pre-release builds are flagged dev */
    for (const v of ["0.0.0", "0.0.0-ci", "0.0.0-dev", "dev", "", "1.2.3-beta.1", "1.2.3+build"]) {
      assertEquals(new Version(v).isDev(), true, `${v} should be dev`);
    }
  });

  it("does NOT flag clean releases", () => {
    /* @Then clean releases are not flagged dev */
    for (const v of ["0.1.0", "1.0.0", "v2.3.4"]) {
      assertEquals(new Version(v).isDev(), false, `${v} should be a release`);
    }
  });
});

describe("Version.isNewerThan", () => {
  it("compares releases", () => {
    /* @Then isNewerThan is true only for a strictly greater release */
    assertEquals(new Version("0.2.0").isNewerThan(new Version("0.1.0")), true);
    assertEquals(new Version("0.1.0").isNewerThan(new Version("0.1.0")), false);
    assertEquals(new Version("0.1.0").isNewerThan(new Version("0.2.0")), false);
  });
});

describe("currentTarget", () => {
  it("maps supported os/arch combos", () => {
    /* @Then supported os/arch combos map to their asset key */
    assertEquals(currentTarget("linux", "x86_64"), "linux-x64");
    assertEquals(currentTarget("darwin", "x86_64"), "darwin-x64");
    assertEquals(currentTarget("darwin", "aarch64"), "darwin-arm64");
    assertEquals(currentTarget("windows", "x86_64"), "windows-x64");
  });

  it("returns null for unpublished combos", () => {
    /* @Then an unpublished combo maps to null */
    assertEquals(currentTarget("linux", "aarch64"), null);
  });
});
