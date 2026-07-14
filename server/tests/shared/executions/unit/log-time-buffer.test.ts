import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { LogTimeBuffer } from "@server/shared/executions/outbound/streaming/log-time-buffer.ts";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("LogTimeBuffer", {
  sanitizeOps: false,
  sanitizeResources: false,
}, () => {
  it("buffers until the line cap, then drains in order (no content lost)", () => {
    /* @Given a buffer with a 3-line cap */
    const b = new LogTimeBuffer(10_000, 3);
    /* @When lines are added past the cap and then drained */
    assertEquals(b.add("1"), null);
    assertEquals(b.add("2"), null);
    assertEquals(b.add("3"), "1\n2\n3"); // cap reached → flush
    assertEquals(b.add("4"), null);
    /* @Then the cap triggers a flush and drain empties the rest in order */
    assertEquals(b.drain(), "4"); // boundary drain (adapter calls this)
    assertEquals(b.drain(), null); // empty
  });

  it("flushes once the latency window has elapsed (checked on the next add)", async () => {
    /* @Given a buffer with a 20ms latency window */
    const b = new LogTimeBuffer(20, 100);
    assertEquals(b.add("a"), null); // window just started
    /* @When the window elapses before the next add */
    await delay(40); // window elapsed; no timer involved
    /* @Then that next add observes the elapsed window and flushes */
    assertEquals(b.add("b"), "a\nb"); // next add observes elapsed → flush
  });

  it("drain() is the boundary flush adapters call before non-log / end / error", () => {
    /* @Given a buffer holding two unflushed lines */
    const b = new LogTimeBuffer(10_000, 100);
    b.add("x");
    b.add("y");
    /* @When drain() is called */
    /* @Then it returns the buffered lines and is empty afterwards */
    assertEquals(b.drain(), "x\ny"); // adapter's `finally` path
    assertEquals(b.drain(), null);
  });
});
