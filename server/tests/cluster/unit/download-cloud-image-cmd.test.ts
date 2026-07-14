import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { downloadCloudImageCmd } from "@server/cluster/outbound/executions/proxmox/images/adapter.ts";

/**
 * The cloud-image download must emit newline-delimited progress so it
 * streams over SSH (curl -fsSL was silent; curl's bar is \r-based).
 */
describe("downloadCloudImageCmd", () => {
  const path = "/var/lib/vz/template/qemu/jammy.img";
  const url = "https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-amd64.img";
  const cmd = downloadCloudImageCmd(path, url);

  it("references both the target path and the url", () => {
    /* @Given the generated download command */
    /* @Then it embeds the target path and the source url */
    assertStringIncludes(cmd, path);
    assertStringIncludes(cmd, url);
  });

  it("downloads in the background and polls size for progress", () => {
    /* @Given the generated download command */
    /* @Then it backgrounds curl and polls file size for streamable progress */
    assertStringIncludes(cmd, "curl -fL -o");
    assertStringIncludes(cmd, "& pid=$!");
    assertStringIncludes(cmd, "kill -0 $pid");
    assertStringIncludes(cmd, "stat -c%s");
    assertStringIncludes(cmd, "download:");
    assertStringIncludes(cmd, "wait $pid"); // propagates curl's exit code
  });

  it("does not use the silent single-shot form", () => {
    /* @Given the generated download command */
    /* @Then the silent curl -fsSL form is absent */
    assertEquals(cmd.includes("curl -fsSL -o"), false);
  });

  it("still short-circuits a cached image, but not silently", () => {
    /* @Given the generated download command */
    /* @Then it short-circuits a cached file with a visible "already cached" line */
    assertStringIncludes(cmd, `[ -f ${path} ]`);
    assertStringIncludes(cmd, "already cached");
  });

  it("guards the percentage against a missing/zero Content-Length", () => {
    /* @Given the generated download command */
    /* @Then it guards against a zero size and falls back to raw bytes */
    assertStringIncludes(cmd, `[ "$sz" -gt 0 ]`);
    assertStringIncludes(cmd, "$cur bytes"); // fallback line w/o percentage
  });
});
