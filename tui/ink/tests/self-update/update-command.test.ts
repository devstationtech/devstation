import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type { UpdateStatus } from "@ui/self-update/update-check.ts";
import { runUpdateCheck } from "@ui/self-update/update-command.ts";

/**
 * `devstation update --check` — the headless escape hatch for the stale
 * update cache: it must always force a fresh check (bypassing the 24h
 * window) and report the outcome with a scripting-friendly exit code.
 */

function capture() {
  const lines: string[] = [];
  return { lines, print: (l: string) => lines.push(l) };
}

function checkReturning(status: UpdateStatus) {
  let forced: boolean | undefined;
  const check = (opts: { force?: boolean } = {}) => {
    forced = opts.force;
    return Promise.resolve(status);
  };
  return { check, wasForced: () => forced };
}

describe("runUpdateCheck", () => {
  it("forces the check, bypassing the cache window", async () => {
    /* @Given a check seam recording its options */
    const { check, wasForced } = checkReturning({ kind: "current" });

    /* @When the command runs */
    await runUpdateCheck(check, capture().print);

    /* @Then the check was invoked with force (cache and passive gates bypassed) */
    assertEquals(wasForced(), true);
  });

  it("reports an available release and exits 0", async () => {
    /* @Given a newer release on the manifest */
    const { check } = checkReturning({
      kind: "available",
      latest: "9.9.9",
      manifest: { version: "9.9.9", tag: "v9.9.9", assets: {} },
    });
    const { lines, print } = capture();

    /* @When the command runs */
    const code = await runUpdateCheck(check, print);

    /* @Then it announces the version jump and how to install */
    assertEquals(code, 0);
    assertStringIncludes(lines.join("\n"), "update available:");
    assertStringIncludes(lines.join("\n"), "9.9.9");
  });

  it("reports up-to-date and exits 0", async () => {
    /* @Given the current version matches the manifest */
    const { check } = checkReturning({ kind: "current" });
    const { lines, print } = capture();

    /* @When the command runs */
    const code = await runUpdateCheck(check, print);

    /* @Then it confirms freshness */
    assertEquals(code, 0);
    assertStringIncludes(lines.join("\n"), "up to date");
  });

  it("exits 1 when the manifest is unreachable", async () => {
    /* @Given the update server cannot be reached */
    const { check } = checkReturning({ kind: "unknown" });
    const { lines, print } = capture();

    /* @When the command runs */
    const code = await runUpdateCheck(check, print);

    /* @Then the failure is explicit and the exit code scripting-friendly */
    assertEquals(code, 1);
    assertStringIncludes(lines.join("\n"), "could not reach");
  });

  it("exits 1 on an unsupported target", async () => {
    /* @Given a platform we do not publish binaries for */
    const { check } = checkReturning({ kind: "skipped", reason: "unsupported-target" });
    const { lines, print } = capture();

    /* @When the command runs */
    const code = await runUpdateCheck(check, print);

    /* @Then the reason is surfaced */
    assertEquals(code, 1);
    assertStringIncludes(lines.join("\n"), "unsupported-target");
  });
});
