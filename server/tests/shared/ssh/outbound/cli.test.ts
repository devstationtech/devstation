import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type {
  Process,
  ProcessEvent,
  ProcessRequest,
} from "@server/shared/process/domain/ports/outbound/process.ts";
import { SshCli, type Target } from "@server/shared/ssh/outbound/cli.ts";

/** Records what spawn was asked for; replies with a canned exit code. */
class RecordingProcess implements Process {
  readonly calls: ProcessRequest[] = [];
  constructor(
    private readonly stdout: string[] = [],
    private readonly stderr: string[] = [],
    private readonly exitCode = 0,
  ) {}
  async *run(request: ProcessRequest): AsyncIterable<ProcessEvent> {
    this.calls.push(request);
    for (const line of this.stdout) yield { type: "stdout", line };
    for (const line of this.stderr) yield { type: "stderr", line };
    yield { type: "exit", code: this.exitCode };
  }
}

const TARGET: Target = {
  host: "10.0.0.5",
  user: "ubuntu",
  identityFile: "/home/dev/.ssh/devstation_ed25519",
};

describe("SshCli — spawn shape (key-only, no sshpass)", () => {
  it("spawns `ssh` directly, never `sshpass`", async () => {
    /* @Given a recording process and an SshCli */
    const proc = new RecordingProcess([], [], 0);
    const sut = new SshCli(proc);

    /* @When a command is run against the target */
    for await (const _ of sut.run(TARGET, "uptime")) { /* drain */ }

    /* @Then it spawns `ssh` directly (no sshpass) */
    assertEquals(proc.calls.length, 1);
    assertEquals(proc.calls[0].command, "ssh");
  });

  it("passes -i <identityFile> and key-only enforcement flags", async () => {
    /* @Given a recording process and an SshCli */
    const proc = new RecordingProcess([], [], 0);
    const sut = new SshCli(proc);

    /* @When a command is run against the target */
    for await (const _ of sut.run(TARGET, "uptime")) { /* drain */ }

    /* @Then it passes -i <identityFile> plus BatchMode/IdentitiesOnly enforcement */
    const args = proc.calls[0].args;
    // Identity flag must come before the destination.
    const iIdx = args.indexOf("-i");
    assertEquals(args[iIdx + 1], "/home/dev/.ssh/devstation_ed25519");

    // Key-only enforcement: BatchMode disables password prompts,
    // IdentitiesOnly forbids ssh-agent identities. Without these the
    // process either hangs on a password prompt or tries the wrong key.
    const joined = args.join(" ");
    assertStringIncludes(joined, "BatchMode=yes");
    assertStringIncludes(joined, "IdentitiesOnly=yes");
  });

  it("ships the command over stdin, never argv (secrets must not appear in the process list)", async () => {
    /* @Given a recording process and an SshCli */
    const proc = new RecordingProcess([], [], 0);
    const sut = new SshCli(proc);

    /* @When a command carrying a secret export is run against the target */
    const script = "export TOKEN='s3cr3t-value'\nsudo apt-get update";
    for await (const _ of sut.run(TARGET, script)) { /* drain */ }

    /* @Then argv ends with user@host + a fixed `bash -s` — the script itself
       travels via stdin, where no process list can read it */
    const call = proc.calls[0];
    assertEquals(call.args[call.args.length - 2], "ubuntu@10.0.0.5");
    assertEquals(call.args[call.args.length - 1], "bash -s");
    assertEquals(call.stdin, script);
    assertEquals(call.args.join(" ").includes("s3cr3t-value"), false);
  });

  it("yields a 'done' event carrying the captured exit code + streams", async () => {
    /* @Given a process replying with stdout/stderr and exit 7 */
    const proc = new RecordingProcess(["hello"], ["warn"], 7);
    const sut = new SshCli(proc);

    /* @When the run is drained for the 'done' event */
    let done: { code: number; stdout: string; stderr: string } | null = null;
    for await (const event of sut.run(TARGET, "noop")) {
      if (event.type === "done") {
        done = { code: event.code, stdout: event.stdout, stderr: event.stderr };
      }
    }

    /* @Then 'done' carries the exit code and captured streams */
    assertEquals(done?.code, 7);
    assertEquals(done?.stdout, "hello");
    assertEquals(done?.stderr, "warn");
  });
});
