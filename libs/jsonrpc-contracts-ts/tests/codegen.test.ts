/**
 * Smoke for the codegen output: the generated wire classes carry the
 * `type` discriminator the consumers depend on, the constructors hold
 * the declared fields, and JSON round-trip preserves the shape.
 *
 * If the codegen output drifts, every UI integration that consumes a
 * `*.gen.ts` discriminated union breaks. Catch it here, not at runtime.
 */
import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Cancelled,
  ExecutionEventNotification,
  Failed,
  Log,
  Step,
  Succeeded,
} from "@jsonrpc-contracts-ts/executions.gen.ts";

describe("executions.gen — wire classes carry the type discriminator", () => {
  it("Log has type='log' and a 'line' field", () => {
    /* @Given a Log constructed with a line */
    const log = new Log("hello");
    /* @Then it tags itself with the 'log' discriminator and holds the line */
    assertEquals(log.type, "log");
    assertEquals(log.line, "hello");
  });

  it("Step has type='step' with name + optional detail", () => {
    /* @Given a Step with only a name */
    const bare = new Step("plan");
    /* @Then it carries the 'step' discriminator and the name */
    assertEquals(bare.type, "step");
    assertEquals(bare.name, "plan");

    /* @And a Step built with a detail retains it */
    const detailed = new Step("plan", "validating inputs");
    assertEquals(detailed.detail, "validating inputs");
  });

  it("terminals share the same type-tag pattern", () => {
    /* @Given the terminal event classes @Then each tags itself and keeps its payload */
    assertEquals(new Succeeded().type, "succeeded");
    assertEquals(new Failed("boom").type, "failed");
    assertEquals(new Failed("boom").error, "boom");
    assertEquals(new Cancelled().type, "cancelled");
  });
});

describe("executions.gen — JSON round-trip preserves discriminator and payload", () => {
  it("Log → JSON → object keeps type + line", () => {
    /* @Given a Log serialized to JSON and back */
    const wire = JSON.parse(JSON.stringify(new Log("starting")));
    /* @Then the wire object is exactly the discriminator + line */
    assertEquals(wire, { type: "log", line: "starting" });
  });

  it("ExecutionEventNotification carries executionId + event", () => {
    /* @Given a notification wrapping an execution id + nested event, round-tripped */
    const notif = new ExecutionEventNotification("exec-1", new Step("plan", "ok"));
    const wire = JSON.parse(JSON.stringify(notif));
    /* @Then both the id and the nested event payload survive serialization */
    assertEquals(wire.executionId, "exec-1");
    assertEquals(wire.event.type, "step");
    assertEquals(wire.event.name, "plan");
    assertEquals(wire.event.detail, "ok");
  });
});
