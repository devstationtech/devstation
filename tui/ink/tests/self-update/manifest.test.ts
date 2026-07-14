import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { parseManifest } from "@ui/self-update/manifest.ts";

const VALID = {
  version: "0.2.0",
  tag: "v0.2.0",
  releasedAt: "2026-05-29T00:00:00Z",
  assets: {
    "linux-x64": { url: "https://x/linux.tar.gz", sha256: "aa" },
    "darwin-arm64": { url: "https://x/mac.tar.gz", sha256: "bb" },
  },
};

describe("parseManifest", () => {
  it("parses a valid manifest", () => {
    /* @When a well-formed manifest is parsed */
    const m = parseManifest(VALID);
    /* @Then version, tag and assets are preserved */
    assertEquals(m.version, "0.2.0");
    assertEquals(m.tag, "v0.2.0");
    assertEquals(m.assets["linux-x64"]?.sha256, "aa");
    assertEquals(m.assets["darwin-arm64"]?.url, "https://x/mac.tar.gz");
  });

  it("defaults tag from version when missing", () => {
    /* @When a manifest without a tag is parsed */
    const m = parseManifest({ version: "1.0.0", assets: {} });
    /* @Then the tag defaults to v + version */
    assertEquals(m.tag, "v1.0.0");
  });

  it("drops malformed asset entries but keeps valid ones", () => {
    /* @When a manifest mixing valid and malformed assets is parsed */
    const m = parseManifest({
      version: "0.2.0",
      assets: {
        "linux-x64": { url: "https://x/l", sha256: "aa" },
        "darwin-x64": { url: "https://x/m" }, // missing sha256 → dropped
        "windows-x64": "nope", // not an object → dropped
      },
    });
    /* @Then only the valid asset survives */
    assertEquals(Object.keys(m.assets), ["linux-x64"]);
  });

  it("rejects shapes without version or assets", () => {
    /* @Then shapes missing version or assets are rejected */
    assertThrows(() => parseManifest(null));
    assertThrows(() => parseManifest({ assets: {} }));
    assertThrows(() => parseManifest({ version: "1.0.0" }));
  });
});
