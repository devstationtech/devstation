import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { FakeTime } from "@std/testing/time";
import { waitForSshReady } from "@server/shared/ssh/outbound/wait-for-ready.ts";
import type { SshCli, SshEvent, Target } from "@server/shared/ssh/outbound/cli.ts";

/**
 * `waitForSshReady` blocks until sshd accepts connections, yielding a
 * progress string per retry. Tests pin: immediate-ready (no sleep),
 * ready-even-when-the-probe-command-fails (the loop only cares about
 * reachability), abort, and one retry cycle driven with FakeTime so
 * the 4s interval doesn't slow the suite.
 */

// deno-lint-ignore no-explicit-any
type Anyish = any;

const TARGET: Target = { host: "10.0.0.1", user: "root", identityFile: "/fake/key" };

/** Fake SshCli: each `run` yields the next scripted `done` event. */
function fakeSsh(outcomes: Array<{ code: number; stdout?: string; stderr?: string }>): SshCli {
  let call = 0;
  return {
    async *run(): AsyncIterable<SshEvent> {
      const o = outcomes[Math.min(call, outcomes.length - 1)];
      call++;
      yield { type: "done", code: o.code, stdout: o.stdout ?? "", stderr: o.stderr ?? "" };
    },
  } as Anyish as SshCli;
}

async function drain(gen: AsyncGenerator<string, void>): Promise<string[]> {
  const out: string[] = [];
  for await (const s of gen) out.push(s);
  return out;
}

describe("waitForSshReady", () => {
  it("returns immediately when the first probe succeeds (no retry yielded)", async () => {
    /* @Given an sshd that accepts the very first connection */
    const ssh = fakeSsh([{ code: 0 }]);
    /* @When waiting */
    const yielded = await drain(waitForSshReady(ssh, TARGET, new AbortController().signal));
    /* @Then it completes without yielding any progress line */
    assertEquals(yielded, []);
  });

  it("returns once sshd is reachable even if the probe command exits non-zero", async () => {
    /* @Given a connection that is accepted but `true` somehow exits 1 */
    /* @When waiting — the loop only checks reachability, not the exit code */
    const ssh = fakeSsh([{ code: 1, stderr: "weird" }]);
    /* @Then it still returns (reachable = done), no retry */
    const yielded = await drain(waitForSshReady(ssh, TARGET, new AbortController().signal));
    assertEquals(yielded, []);
  });

  it("throws when the signal is already aborted", async () => {
    /* @Given a pre-aborted signal */
    const ac = new AbortController();
    ac.abort();
    /* @Then the first loop iteration throws before probing */
    await assertRejects(
      () => drain(waitForSshReady(fakeSsh([{ code: 0 }]), TARGET, ac.signal)),
      Error,
      "aborted",
    );
  });

  it("retries on 'Connection refused', yielding progress, then returns when sshd comes up", async () => {
    const time = new FakeTime();
    try {
      /* @Given a probe refused once, then accepted */
      const ssh = fakeSsh([
        { code: 255, stderr: "ssh: connect to host 10.0.0.1 port 22: Connection refused" },
        { code: 0 },
      ]);
      const gen = waitForSshReady(ssh, TARGET, new AbortController().signal);

      /* @When the first attempt is consumed — it yields a progress line */
      const first = await gen.next();
      assertEquals(first.done, false);
      assertEquals((first.value as string).includes("waiting for sshd on 10.0.0.1"), true);

      /* @And the retry interval elapses */
      const secondP = gen.next();
      await time.tickAsync(4_000);
      const second = await secondP;

      /* @Then the second probe succeeds and the generator completes */
      assertEquals(second.done, true);
    } finally {
      time.restore();
    }
  });
});
