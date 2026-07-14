import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { sha256Hex, TOFU_VERSION, verifyTofuArchive } from "../scripts/tofu-bundle.ts";

/**
 * The bundled OpenTofu must be verified against the pinned upstream SHA256
 * before anything is extracted or cached. A tampered download or a forgotten
 * pin is a hard build failure, never a warning.
 */
describe("verifyTofuArchive", () => {
  const bytes = new TextEncoder().encode("tofu archive bytes");

  it("accepts bytes matching the pinned checksum", async () => {
    /* @Given pins carrying the exact hash of the payload */
    const pins = { "tofu_test.zip": await sha256Hex(bytes) };

    /* @Then verification passes silently */
    await verifyTofuArchive("tofu_test.zip", bytes, pins);
  });

  it("rejects bytes that do not match the pin (possible MITM)", async () => {
    /* @Given a pin for different content */
    const pins = { "tofu_test.zip": await sha256Hex(new TextEncoder().encode("other")) };

    /* @Then verification is a hard failure */
    await assertRejects(
      () => verifyTofuArchive("tofu_test.zip", bytes, pins),
      Error,
      "SHA256 mismatch",
    );
  });

  it("rejects an archive with no pin at all (forgotten version bump)", async () => {
    /* @Given pins that don't know this archive */
    /* @Then verification refuses to proceed unverified */
    await assertRejects(
      () => verifyTofuArchive("tofu_unknown.zip", bytes, {}),
      Error,
      "no pinned SHA256",
    );
  });

  it("the real pin table covers every release target of the current version", async () => {
    /* @Given the four shipped targets */
    const archives = [
      `tofu_${TOFU_VERSION}_linux_amd64.zip`,
      `tofu_${TOFU_VERSION}_darwin_amd64.zip`,
      `tofu_${TOFU_VERSION}_darwin_arm64.zip`,
      `tofu_${TOFU_VERSION}_windows_amd64.zip`,
    ];

    /* @Then each fails ONLY with a mismatch (a pin exists), never "no pinned SHA256" */
    for (const archive of archives) {
      const error = await assertRejects(() => verifyTofuArchive(archive, bytes));
      assertEquals((error as Error).message.includes("SHA256 mismatch"), true);
    }
  });
});
