import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { InMemoryExecution } from "@server/shared/executions/outbound/in-memory-execution.ts";
import type { ExecutionEvent } from "@server/shared/executions/domain/events/event.ts";
import { Failed, Log, Succeeded } from "@jsonrpc-contracts-ts/executions.gen.ts";

/**
 * InMemoryExecution is the per-run event buffer + watcher pump that
 * every long-running job streams through. Its contract is subtle:
 * after the first terminal event the buffer is closed; late watchers
 * replay history then exit; multiple concurrent watchers see the
 * same stream.
 */

function newExec(): InMemoryExecution {
  return new InMemoryExecution(crypto.randomUUID(), new AbortController().signal);
}

async function drain(it: AsyncIterable<ExecutionEvent>): Promise<ExecutionEvent[]> {
  const out: ExecutionEvent[] = [];
  for await (const e of it) out.push(e);
  return out;
}

describe("InMemoryExecution — single watcher", () => {
  it("yields all broadcast events in order, then ends on the terminal", async () => {
    /* @Given a fresh execution and a watcher attached before any broadcast */
    const exec = newExec();
    const watchTask = drain(exec.watch());
    /* @When two logs followed by a Succeeded terminal are broadcast */
    await exec.broadcast(new Log("first"));
    await exec.broadcast(new Log("second"));
    await exec.broadcast(new Succeeded());
    /* @Then the watcher receives all three in order and closes */
    const events = await watchTask;
    assertEquals(events.length, 3);
    assertEquals((events[0] as Log).line, "first");
    assertEquals((events[1] as Log).line, "second");
    assertEquals(events[2].type, "succeeded");
  });

  it("treats the first terminal as final; subsequent broadcasts are dropped", async () => {
    /* @Given an execution that has already reached a terminal */
    const exec = newExec();
    const watchTask = drain(exec.watch());
    await exec.broadcast(new Succeeded());
    /* @When more events are broadcast AFTER the terminal */
    await exec.broadcast(new Log("late"));
    await exec.broadcast(new Failed("ignored"));
    /* @Then only the original terminal is delivered */
    const events = await watchTask;
    assertEquals(events.length, 1);
    assertEquals(events[0].type, "succeeded");
  });
});

describe("InMemoryExecution — replay semantics", () => {
  it("a late watcher receives all buffered events from the start (replay), not just live ones", async () => {
    /* @Given an execution where two logs are broadcast BEFORE any watcher attaches */
    const exec = newExec();
    await exec.broadcast(new Log("before-1"));
    await exec.broadcast(new Log("before-2"));
    /* @When a watcher attaches after the fact */
    const watchTask = drain(exec.watch());
    await exec.broadcast(new Succeeded());
    /* @Then the watcher sees the buffered logs from the start + the new terminal */
    const events = await watchTask;
    assertEquals(events.length, 3);
    assertEquals((events[0] as Log).line, "before-1");
    assertEquals((events[1] as Log).line, "before-2");
    assertEquals(events[2].type, "succeeded");
  });

  it("a watcher attached AFTER the terminal still replays history and then exits", async () => {
    /* @Given an execution that has fully completed */
    const exec = newExec();
    await exec.broadcast(new Log("old"));
    await exec.broadcast(new Failed("boom"));
    /* @When a brand-new watcher attaches */
    const events = await drain(exec.watch());
    /* @Then it replays the whole history and ends cleanly (no hang) */
    assertEquals(events.length, 2);
    assertEquals((events[0] as Log).line, "old");
    assertEquals(events[1].type, "failed");
  });
});

describe("InMemoryExecution — concurrent watchers", () => {
  it("two watchers attached at the same time both receive the same complete stream", async () => {
    /* @Given an execution with two concurrent watchers */
    const exec = newExec();
    const a = drain(exec.watch());
    const b = drain(exec.watch());
    /* @When events are broadcast */
    await exec.broadcast(new Log("L1"));
    await exec.broadcast(new Log("L2"));
    await exec.broadcast(new Succeeded());
    /* @Then both watchers see the same stream (independent iteration, shared buffer) */
    const [eventsA, eventsB] = await Promise.all([a, b]);
    assertEquals(eventsA.length, 3);
    assertEquals(eventsB.length, 3);
    assertEquals((eventsA[0] as Log).line, "L1");
    assertEquals((eventsB[0] as Log).line, "L1");
  });
});

describe("InMemoryExecution — terminated flag", () => {
  it("is false until a terminal event is broadcast", async () => {
    /* @Given a fresh execution */
    const exec = newExec();
    assertEquals(exec.terminated, false);
    /* @When a non-terminal event is broadcast */
    await exec.broadcast(new Log("x"));
    /* @Then terminated is still false */
    assertEquals(exec.terminated, false);
    /* @When the terminal is broadcast */
    await exec.broadcast(new Succeeded());
    /* @Then terminated becomes true */
    assertEquals(exec.terminated, true);
  });

  it("stays true after a terminal even if late broadcasts try to add events", async () => {
    /* @Given a terminated execution */
    const exec = newExec();
    await exec.broadcast(new Failed("x"));
    assertEquals(exec.terminated, true);
    /* @When a late broadcast arrives */
    await exec.broadcast(new Log("ignored"));
    /* @Then terminated remains true (state is monotonic) */
    assertEquals(exec.terminated, true);
  });
});
