import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { join } from "node:path";
import type {
  Process,
  ProcessEvent,
  ProcessRequest,
} from "@server/shared/process/domain/ports/outbound/process.ts";
import { IdentityProvider } from "@server/shared/ssh/outbound/identity.ts";

/**
 * Records every spawn and pretends ssh-keygen succeeded by writing
 * stub key files to the requested -f path.
 */
class RecordingProcess implements Process {
  readonly calls: ProcessRequest[] = [];
  constructor(private readonly exitCode = 0) {}
  async *run(request: ProcessRequest): AsyncIterable<ProcessEvent> {
    this.calls.push(request);
    if (request.command === "ssh-keygen" && this.exitCode === 0) {
      const i = request.args.indexOf("-f");
      const keyPath = request.args[i + 1];
      await Deno.writeTextFile(keyPath, "FAKE PRIVATE KEY");
      await Deno.writeTextFile(`${keyPath}.pub`, "ssh-ed25519 AAAA fake devstation-cli\n");
    }
    yield { type: "exit", code: this.exitCode };
  }
}

describe("IdentityProvider", () => {
  it("generates ~/.ssh/devstation_ed25519 on first call (lazy + idempotent)", async () => {
    /* @Given a fresh home and a recording ssh-keygen */
    const home = await Deno.makeTempDir({ prefix: "devstation-identity-" });
    const proc = new RecordingProcess();
    const sut = new IdentityProvider(home, proc);

    /* @When ensureIdentity is called the first time */
    const first = await sut.ensureIdentity();

    /* @Then it generates the ed25519 key via ssh-keygen with the expected flags */
    assertEquals(first, join(home, ".ssh", "devstation_ed25519"));
    assertEquals(proc.calls.length, 1);
    assertEquals(proc.calls[0].command, "ssh-keygen");
    assertStringIncludes(proc.calls[0].args.join(" "), "-t ed25519");
    assertStringIncludes(proc.calls[0].args.join(" "), "-C devstation-cli");

    /* @And a second call reuses the file without spawning again (idempotent) */
    // Second call must reuse the file — no new spawn.
    const second = await sut.ensureIdentity();
    assertEquals(second, first);
    assertEquals(proc.calls.length, 1);

    await Deno.remove(home, { recursive: true });
  });

  it("returns the public key contents trimmed", async () => {
    /* @Given an identity provider over a recording ssh-keygen */
    const home = await Deno.makeTempDir({ prefix: "devstation-identity-" });
    const proc = new RecordingProcess();
    const sut = new IdentityProvider(home, proc);

    /* @When the public key is requested */
    const pub = await sut.publicKey();

    /* @Then the contents are returned trimmed */
    assertEquals(pub, "ssh-ed25519 AAAA fake devstation-cli");
    await Deno.remove(home, { recursive: true });
  });

  it("surfaces a clear error when ssh-keygen fails", async () => {
    /* @Given an ssh-keygen that exits non-zero */
    const home = await Deno.makeTempDir({ prefix: "devstation-identity-" });
    const proc = new RecordingProcess(1);
    const sut = new IdentityProvider(home, proc);

    /* @When ensureIdentity is called */
    /* @Then it rejects with a clear ssh-keygen-failed error */
    await assertRejects(
      () => sut.ensureIdentity(),
      Error,
      "ssh-keygen failed (exit 1)",
    );

    await Deno.remove(home, { recursive: true });
  });

  // Regression for a hang where `ssh-keygen` on Windows could stall
  // (PATH lookup, antivirus intercept, etc.) with no output and no
  // exit event, freezing the caller indefinitely. This test pins the
  // hard 30s timeout: a Process that never yields `exit` must NOT
  // freeze the caller indefinitely.
  it("rejects with a stall message when ssh-keygen hangs indefinitely", async () => {
    /* @Given an ssh-keygen process that never yields exit */
    const home = await Deno.makeTempDir({ prefix: "devstation-identity-" });

    // A Process whose `run()` never yields — simulates ssh-keygen
    // spawning and never exiting. The caller used to await forever.
    const hangingProc: Process = {
      // deno-lint-ignore require-yield
      async *run(): AsyncIterable<ProcessEvent> {
        await new Promise<never>(() => {
          // never resolves; the timeout has to win
        });
      },
    };
    const sut = new IdentityProvider(home, hangingProc);

    /* @When ensureIdentity is called */
    // Speed the test up by waiting only as long as needed — the
    // production budget is 30s, so we accept any failure under 35s.
    const start = Date.now();
    const err = await assertRejects(
      () => sut.ensureIdentity(),
      Error,
    );
    const elapsed = Date.now() - start;

    /* @Then it gives up with a stall message within the production budget */
    assertStringIncludes(err.message, "ssh-keygen spawn stalled");
    // Sanity: must give up within the production budget + small margin.
    assertEquals(elapsed < 35_000, true, `elapsed=${elapsed}ms exceeded the ceiling`);

    await Deno.remove(home, { recursive: true });
  });
});
