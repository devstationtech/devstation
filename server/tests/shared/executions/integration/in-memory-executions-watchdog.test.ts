import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { InMemoryExecutions } from "@server/shared/executions/outbound/in-memory-executions.ts";
import type { Task } from "@server/shared/executions/domain/models/task.ts";
import type { ExecutionEvent } from "@server/shared/executions/domain/events/event.ts";
import { type Failed, Log } from "@jsonrpc-contracts-ts/executions.gen.ts";

/**
 * Every execution must reach exactly one terminal. A task wedged
 * awaiting a subscriber/dispatch used to hang the watcher forever.
 * The liveness watchdog guarantees a terminal; a slow-but-progressing
 * task must NOT be killed.
 */
const collect = async (op: { watch(): AsyncIterable<ExecutionEvent> }) => {
  const events: ExecutionEvent[] = [];
  for await (const e of op.watch()) events.push(e);
  return events;
};
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("InMemoryExecutions — liveness watchdog", {
  // The wedge scenario deliberately leaves a never-settling generator.
  sanitizeOps: false,
  sanitizeResources: false,
}, () => {
  it("forces a Failed terminal when the task wedges (no progress, never settles)", async () => {
    /* @Given a watchdog and a task that never emits nor settles */
    const ex = new InMemoryExecutions(50);
    // Never emits, never settles — the wedge the watchdog must break.
    const task: Task = { run: () => new Promise<never>(() => {}) };

    /* @When the execution is started and watched */
    const op = ex.start(task);
    const events = await collect(op);

    /* @Then the watchdog forces a single Failed terminal mentioning "stalled" */
    assertEquals(events.length, 1);
    assertEquals(events[0].type, "failed");
    assertStringIncludes((events[0] as Failed).error, "stalled");
  });

  it("does not kill a task that completes within the idle window", async () => {
    /* @Given a generous watchdog and a task that finishes quickly */
    const ex = new InMemoryExecutions(1000);
    const task: Task = {
      // deno-lint-ignore require-await -- run satisfies the async Task port
      run: async (_op, emitter) => {
        emitter.emit(new Log("a"));
        emitter.emit(new Log("b"));
      },
    };

    /* @When the execution is started and watched */
    const events = await collect(ex.start(task));

    /* @Then it succeeds with both lines intact and no Failed terminal */
    // The runtime emitter may coalesce consecutive log lines; what matters
    // here is the watchdog did NOT kill it — it reached the natural
    // Succeeded with both lines intact and in order.
    assertEquals(events.filter((e) => e.type === "failed").length, 0);
    assertEquals(events[events.length - 1].type, "succeeded");
    assertEquals(
      events.filter((e) => e.type === "log").flatMap((e) => (e as Log).line.split("\n")),
      ["a", "b"],
    );
  });

  it("resets the watchdog on each event (slow but progressing survives)", async () => {
    /* @Given an 80ms watchdog and a task that emits every 40ms */
    const ex = new InMemoryExecutions(80);
    const task: Task = {
      run: async (_op, emitter) => {
        for (let i = 0; i < 4; i++) {
          await delay(40); // < 80ms idle → keeps resetting, never trips
          emitter.emit(new Log(String(i)));
        }
      },
    };

    /* @When the execution is started and watched */
    const events = await collect(ex.start(task));

    /* @Then progress re-arms the watchdog: it succeeds with every line in order */
    assertEquals(events.filter((e) => e.type === "failed").length, 0);
    assertEquals(events[events.length - 1].type, "succeeded");
    // Lines may be coalesced into fewer log events; every line must still
    // survive, in order — progress (each emit) re-armed the watchdog.
    assertEquals(
      events.filter((e) => e.type === "log").flatMap((e) => (e as Log).line.split("\n")),
      ["0", "1", "2", "3"],
    );
  });

  // The default constructor disables the watchdog because a finite default
  // would kill legitimate long-silent steps (e.g., a binary download phase).
  // Users can always abort via `execution_cancel`. The watchdog is opt-in
  // via constructor argument for tests or environments that need it.
  it("default constructor disables the watchdog — long-silent tasks run to natural completion", async () => {
    /* @Given the default constructor (no watchdog) and a long-silent task */
    const ex = new InMemoryExecutions(); // no arg → no watchdog
    const task: Task = {
      run: async (_op, emitter) => {
        // 200ms of complete silence — would trip ANY finite watchdog
        // below 200ms. Confirm it doesn't trip when undefined.
        await delay(200);
        emitter.emit(new Log("survived"));
      },
    };

    /* @When the execution is started and watched */
    const events = await collect(ex.start(task));

    /* @Then no watchdog trips: the task runs to natural success */
    assertEquals(events.filter((e) => e.type === "failed").length, 0);
    assertEquals(events[events.length - 1].type, "succeeded");
    const logs = events.filter((e) => e.type === "log").map((e) => (e as Log).line);
    assertEquals(logs.some((l) => l.includes("survived")), true);
  });
});
