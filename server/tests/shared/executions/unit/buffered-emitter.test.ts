import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type { ExecutionEvent } from "@server/shared/executions/domain/events/event.ts";
import { Log, Step, Succeeded } from "@jsonrpc-contracts-ts/executions.gen.ts";
import { BufferedEmitter } from "@server/shared/executions/outbound/streaming/buffered-emitter.ts";

const sinkOf = () => {
  const out: ExecutionEvent[] = [];
  return { out, sink: (e: ExecutionEvent) => out.push(e) };
};
const shape = (e: ExecutionEvent) =>
  e.type === "log"
    ? { type: "log", line: (e as Log).line }
    : e.type === "step"
    ? { type: "step", name: (e as Step).name, detail: (e as Step).detail }
    : { type: e.type };

describe("BufferedEmitter", () => {
  it("batches consecutive logs into one frame (maxLines), content/order kept", () => {
    /* @Given an emitter with a 3-line cap */
    const { out, sink } = sinkOf();
    const e = new BufferedEmitter(sink, 10_000, 3);
    /* @When three consecutive logs are emitted */
    e.emit(new Log("a"));
    e.emit(new Log("b"));
    e.emit(new Log("c")); // hits maxLines → one frame
    /* @Then they coalesce into a single frame, order preserved */
    assertEquals(out.length, 1);
    assertEquals(shape(out[0]), { type: "log", line: "a\nb\nc" });
  });

  it("flushes buffered logs before a non-log event, preserving order", () => {
    /* @Given an emitter with buffered logs */
    const { out, sink } = sinkOf();
    const e = new BufferedEmitter(sink, 10_000, 100);
    e.emit(new Log("x"));
    e.emit(new Log("y"));
    /* @When a non-log event is emitted */
    e.emit(new Step("plan", "building"));
    /* @Then buffered logs flush first, then the step, in order */
    assertEquals(out.map(shape), [
      { type: "log", line: "x\ny" },
      { type: "step", name: "plan", detail: "building" },
    ]);
  });

  it("flush() drains whatever is buffered (runtime calls it before the terminal)", () => {
    /* @Given a single buffered, not-yet-flushed log */
    const { out, sink } = sinkOf();
    const e = new BufferedEmitter(sink, 10_000, 100);
    e.emit(new Log("tail"));
    assertEquals(out.length, 0); // still buffered
    /* @When flush() runs and the terminal is broadcast */
    e.flush();
    sink(new Succeeded()); // runtime broadcasts the terminal after flush
    /* @Then the buffered log emerges before the terminal event */
    assertEquals(out.map(shape), [{ type: "log", line: "tail" }, { type: "succeeded" }]);
  });
});
