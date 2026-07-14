import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { AsyncQueue } from "@server/station/outbound/installer/proxmox/async-queue.ts";
import { readPublishedValue } from "@server/station/outbound/installer/proxmox/runner/read-published-value.ts";
import { runVerify } from "@server/station/outbound/installer/proxmox/runner/run-verify.ts";
import { RuntimeStepContext } from "@server/station/outbound/installer/proxmox/step-context.ts";
import { Verify } from "@server/blueprint/domain/models/step/verify.ts";
import { Role as ServiceRole } from "@server/station/domain/models/service/role.ts";
import type { PublishSource } from "@server/blueprint/domain/models/step/publish-source.ts";
import type { Context as StepContext } from "@server/blueprint/contracts/step/context/context.ts";
import type { Peer } from "@server/blueprint/contracts/step/context/peer.ts";

/**
 * Proxmox installer internals — the small runtime units the installer
 * composes per step: the producer-interleaving `AsyncQueue`, the
 * publish-value reader, the retrying verify probe, and the per-step
 * `RuntimeStepContext`. Tested in isolation with minimal fakes.
 */

// deno-lint-ignore no-explicit-any
type Anyish = any;

/** Minimal StepContext fake — only the fields each unit touches. */
function fakeCtx(
  ssh: { run: (cmd: string) => Promise<{ exitCode: number; stdout: string; stderr: string }> },
): StepContext {
  return {
    inputs: { string: () => "", number: () => 0, boolean: () => false },
    secrets: { get: () => Promise.resolve(""), put: () => Promise.resolve() },
    ssh: { run: ssh.run, upload: () => Promise.resolve() },
    role: { name: "main" },
    host: "10.0.0.1",
    fromRole: () => ({ first: () => ({} as Peer), all: () => [] }),
  } as Anyish as StepContext;
}

describe("AsyncQueue", () => {
  it("drains buffered items in FIFO order, then ends on close()", async () => {
    /* @Given three items pushed before any consumer attaches */
    const q = new AsyncQueue<number>();
    q.push(1);
    q.push(2);
    q.push(3);
    q.close();
    /* @When drained */
    const out: number[] = [];
    for await (const v of q.drain()) out.push(v);
    /* @Then FIFO order, terminating cleanly at close */
    assertEquals(out, [1, 2, 3]);
  });

  it("delivers a live push to a consumer already waiting", async () => {
    /* @Given a consumer that started draining an empty queue */
    const q = new AsyncQueue<string>();
    const collected: string[] = [];
    const consumer = (async () => {
      for await (const v of q.drain()) collected.push(v);
    })();
    /* @When an item is pushed after the consumer is parked on the waiter */
    await Promise.resolve();
    q.push("live");
    q.close();
    await consumer;
    /* @Then the waiting consumer received it */
    assertEquals(collected, ["live"]);
  });

  it("close() while a consumer waits ends the iteration", async () => {
    /* @Given a consumer parked on an empty open queue */
    const q = new AsyncQueue<number>();
    const consumer = (async () => {
      const out: number[] = [];
      for await (const v of q.drain()) out.push(v);
      return out;
    })();
    await Promise.resolve();
    /* @When the queue is closed with nothing buffered */
    q.close();
    /* @Then the consumer completes with an empty result */
    assertEquals(await consumer, []);
  });

  it("ignores push after close (no late items leak in)", async () => {
    const q = new AsyncQueue<number>();
    q.push(1);
    q.close();
    q.push(2); // dropped
    const out: number[] = [];
    for await (const v of q.drain()) out.push(v);
    assertEquals(out, [1]);
  });
});

describe("readPublishedValue", () => {
  it("file source — runs `sudo cat` and returns the trimmed stdout", async () => {
    /* @Given a file publish source and an SSH that returns the file body */
    const seen: string[] = [];
    const ctx = fakeCtx({
      run: (cmd) => {
        seen.push(cmd);
        return Promise.resolve({ exitCode: 0, stdout: "  the-token\n", stderr: "" });
      },
    });
    const source: PublishSource = { kind: "file", path: "/var/run/token" };
    /* @When the value is read */
    const value = await readPublishedValue({ ssh: ctx.ssh, source, stdout: "" });
    /* @Then it sudo-cats the path and trims the result */
    assertEquals(value, "the-token");
    assertEquals(seen[0].includes("sudo cat"), true);
    assertEquals(seen[0].includes("/var/run/token"), true);
  });

  it("file source — throws when the remote cat exits non-zero", async () => {
    const ctx = fakeCtx({
      run: () => Promise.resolve({ exitCode: 1, stdout: "", stderr: "No such file" }),
    });
    await assertRejects(
      () =>
        readPublishedValue({
          ssh: ctx.ssh,
          source: { kind: "file", path: "/missing" },
          stdout: "",
        }),
      Error,
      "failed to read /missing",
    );
  });

  it("stdoutLine source — returns the first matching line, prefix stripped + trimmed", async () => {
    /* @Given captured stdout with a prefixed line */
    const ctx = fakeCtx({ run: () => Promise.reject(new Error("ssh not used")) });
    const stdout = "noise\nTOKEN=  abc123  \nmore noise\n";
    const value = await readPublishedValue({
      ssh: ctx.ssh,
      source: { kind: "stdoutLine", prefix: "TOKEN=" },
      stdout,
    });
    /* @Then the value after the prefix, trimmed */
    assertEquals(value, "abc123");
  });

  it("stdoutLine source — throws when no line carries the prefix", async () => {
    const ctx = fakeCtx({ run: () => Promise.reject(new Error("ssh not used")) });
    await assertRejects(
      () =>
        readPublishedValue({
          ssh: ctx.ssh,
          source: { kind: "stdoutLine", prefix: "TOKEN=" },
          stdout: "nothing here\n",
        }),
      Error,
      "no stdout line starting with 'TOKEN='",
    );
  });
});

describe("runVerify", () => {
  it("returns healthy on the first successful probe", async () => {
    /* @Given a verify whose shell exits 0 */
    let calls = 0;
    const ctx = fakeCtx({
      run: () => {
        calls++;
        return Promise.resolve({ exitCode: 0, stdout: "ok", stderr: "" });
      },
    });
    const result = await runVerify({ verify: new Verify("systemctl is-active k3s", 3, 0), ctx });
    /* @Then healthy, and it stopped after the first attempt */
    assertEquals(result.healthy, true);
    assertEquals(calls, 1);
  });

  it("retries up to retryCount and succeeds on a later attempt", async () => {
    /* @Given a probe that fails twice then succeeds */
    let calls = 0;
    const ctx = fakeCtx({
      run: () => {
        calls++;
        return Promise.resolve(
          calls < 3
            ? { exitCode: 1, stdout: "", stderr: "starting" }
            : { exitCode: 0, stdout: "ok", stderr: "" },
        );
      },
    });
    /* @When runVerify runs with retryCount=3, interval=0 */
    const result = await runVerify({ verify: new Verify("probe", 3, 0), ctx });
    /* @Then it reports healthy after exactly 3 attempts */
    assertEquals(result.healthy, true);
    assertEquals(calls, 3);
  });

  it("returns unhealthy carrying the last failure after exhausting retries", async () => {
    /* @Given a probe that always fails */
    const ctx = fakeCtx({
      run: () => Promise.resolve({ exitCode: 7, stdout: "", stderr: "boom" }),
    });
    const result = await runVerify({ verify: new Verify("probe", 2, 0), ctx });
    /* @Then unhealthy, the reason is the last stderr */
    assertEquals(result.healthy, false);
    assertEquals(result.reason, "boom");
  });

  it("falls back to `exit N` as the failure reason when stderr+stdout are empty", async () => {
    const ctx = fakeCtx({
      run: () => Promise.resolve({ exitCode: 42, stdout: "", stderr: "" }),
    });
    const result = await runVerify({ verify: new Verify("probe", 1, 0), ctx });
    assertEquals(result.reason, "exit 42");
  });
});

describe("RuntimeStepContext", () => {
  const ssh = {
    run: () => Promise.resolve({ exitCode: 0, stdout: "", stderr: "" }),
    upload: () => Promise.resolve(),
  };

  function build(opts: {
    inputs?: Record<string, string | number | boolean>;
    resolved?: Record<string, string>;
    peers?: Record<string, Peer[]>;
  }) {
    return new RuntimeStepContext(
      opts.inputs ?? {},
      opts.resolved ?? {},
      new Map<string, string>(),
      new Map<string, string>(),
      ssh as Anyish,
      new ServiceRole("main"),
      "10.0.0.1",
      new Map(Object.entries(opts.peers ?? {})),
    );
  }

  it("inputs.string/number/boolean return the typed value", () => {
    const ctx = build({ inputs: { name: "k3s", port: 6443, ssl: true } });
    assertEquals(ctx.inputs.string("name"), "k3s");
    assertEquals(ctx.inputs.number("port"), 6443);
    assertEquals(ctx.inputs.boolean("ssl"), true);
  });

  it("inputs.string throws when the value isn't a string (type mismatch)", () => {
    /* @Given an input declared as a number */
    const ctx = build({ inputs: { port: 6443 } });
    /* @When read as a string */
    /* @Then it throws — the step author picked the wrong accessor */
    assertThrows(() => ctx.inputs.string("port"), Error, "is not a string");
  });

  it("secrets.put then get round-trips a published secret", async () => {
    const ctx = build({});
    await ctx.secrets.put("token", "abc");
    assertEquals(await ctx.secrets.get("token"), "abc");
  });

  it("secrets.get falls back to a resolved (pre-install) secret", async () => {
    /* @Given a secret resolved from the vault before the step ran */
    const ctx = build({ resolved: { dbPassword: "from-vault" } });
    assertEquals(await ctx.secrets.get("dbPassword"), "from-vault");
  });

  it("secrets.get rejects an unknown secret", async () => {
    const ctx = build({});
    await assertRejects(() => ctx.secrets.get("ghost"), Error, "secret 'ghost' not found");
  });

  it("fromRole returns the peers of an available role", () => {
    /* @Given the 'server' role finished and published one peer */
    const peer = { role: { name: "server" }, host: "10.0.0.9", secrets: {}, outputs: {} } as Peer;
    const ctx = build({ peers: { server: [peer] } });
    /* @Then fromRole exposes first()/all() */
    assertEquals(ctx.fromRole("server").first().host, "10.0.0.9");
    assertEquals(ctx.fromRole("server").all().length, 1);
  });

  it("fromRole throws for a role not yet installed in this run", () => {
    const ctx = build({});
    assertThrows(() => ctx.fromRole("server"), Error, "not yet installed");
  });
});
