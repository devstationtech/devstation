import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { DenoCommandProcess } from "@server/shared/process/outbound/deno-command-adapter.ts";
import { ProcessNotFound } from "@server/shared/process/domain/ports/outbound/process.ts";

/**
 * Regression for a class of bug where the engine runs in MCP stdio
 * mode and its own stdin IS the JSON-RPC stream from the client. Any
 * child process spawned without an explicit stdin redirect inherits
 * that stream and, if it ever prompts (e.g. ssh-keygen on Windows
 * asking "Overwrite (y/n)?" or for a passphrase), blocks indefinitely
 * waiting on input that will never come.
 *
 * The fix is `stdin: "null"` as the default at the Process adapter
 * level. We pin it here by running a child that *would* read from
 * stdin if it could (`cat`); with stdin closed the child sees EOF
 * immediately, prints nothing, and exits 0 — proving stdin is closed.
 *
 * POSIX-only because we rely on `cat`. The exact bug only manifests
 * on Windows (Linux ssh-keygen doesn't prompt in the offending shape)
 * but the *fix* lives in the cross-OS adapter, so verifying on Linux
 * is enough — if we ever removed `stdin:"null"`, the test below would
 * hang and the suite timeout would catch it.
 */
describe("DenoCommandProcess — stdin is closed by default", () => {
  it("a child that reads stdin sees EOF immediately (does not block on inherited MCP stdio)", async () => {
    /* @Given a child (`cat`) that would block reading stdin if it were open */
    if (Deno.build.os === "windows") return; // `cat` unavailable
    const proc = new DenoCommandProcess();
    const start = Date.now();
    const events = [];
    /* @When it is spawned through the adapter and drained */
    for await (
      const event of proc.run({
        command: "cat",
        args: [], // reads from stdin until EOF
      })
    ) {
      events.push(event);
    }
    const elapsed = Date.now() - start;
    /* @Then stdin is closed: it sees EOF immediately and exits 0 */
    // If stdin were inherited from the test runner's terminal, `cat`
    // would hang forever (or until the test runner timeout). Closed
    // stdin → immediate EOF → instant exit.
    assertEquals(
      elapsed < 5_000,
      true,
      `expected immediate EOF, took ${elapsed}ms — stdin was probably not closed`,
    );
    const exit = events.find((e) => e.type === "exit");
    assertEquals(exit?.code, 0);
  });

  // `Deno.Command(missing).spawn()` throws different shapes per OS:
  //   - POSIX: `Deno.errors.NotFound` at construction time
  //   - Windows: generic `Error("Failed to spawn 'X': entity not found")`
  //     at spawn time
  // The adapter normalises both into `ProcessNotFound`, so callers like
  // ProvisioningCli can map cleanly to actionable `ProvisioningRuntimeNotInstalled`.
  it("normalises missing-binary errors into ProcessNotFound across OS shapes", async () => {
    /* @Given a command that does not exist */
    const proc = new DenoCommandProcess();
    /* @When it is run */
    /* @Then the OS-specific spawn error is normalised to ProcessNotFound */
    await assertRejects(
      async () => {
        for await (
          const _ of proc.run({
            command: "definitely-not-a-real-binary-zzz-" + Date.now(),
            args: [],
          })
        ) { /* drain */ }
      },
      ProcessNotFound,
    );
  });
});

/**
 * Sensitive payloads (rendered install scripts carrying resolved secrets)
 * must travel over an explicit stdin pipe, never argv. Uses the deno
 * binary itself as the child so the test is cross-OS.
 */
describe("DenoCommandProcess — explicit stdin payload", () => {
  it("delivers the stdin payload to the child and still drains its output", async () => {
    /* @Given a child that reads stdin fully and echoes it uppercased */
    const sut = new DenoCommandProcess();
    const script = "const t = await new Response(Deno.stdin.readable).text();" +
      "console.log(t.trim().toUpperCase());";

    /* @When run with a stdin payload */
    const lines: string[] = [];
    let exit = -1;
    for await (
      const event of sut.run({
        command: Deno.execPath(),
        args: ["eval", script],
        stdin: "secret-script\n",
      })
    ) {
      if (event.type === "stdout") lines.push(event.line);
      if (event.type === "exit") exit = event.code;
    }

    /* @Then the payload crossed the pipe and the child exited cleanly */
    assertEquals(exit, 0);
    assertEquals(lines, ["SECRET-SCRIPT"]);
  });

  it("survives a child that exits without consuming stdin (broken pipe)", async () => {
    /* @Given a child that never reads stdin and exits immediately */
    const sut = new DenoCommandProcess();

    /* @When run with a payload the child ignores */
    let exit = -1;
    for await (
      const event of sut.run({
        command: Deno.execPath(),
        args: ["eval", "console.log('done')"],
        stdin: "x".repeat(1024),
      })
    ) {
      if (event.type === "exit") exit = event.code;
    }

    /* @Then the run completes with the child's real exit code */
    assertEquals(exit, 0);
  });
});
