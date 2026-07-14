import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import { ClusterIntegration } from "@ui/shared/integrations/cluster-integration.ts";

/**
 * Regression: imagesCreate is a multi-minute silent step (cloud-image
 * download + qm import/template over SSH). The server already emits
 * Step/Log events for the announced executionId; the UI must forward
 * them via onLog so the screen shows progress instead of looking hung.
 */

class FakeClient {
  readonly handlers = new Map<string, Array<(p: unknown) => void>>();
  resolveInvoke!: (v: unknown) => void;

  invoke<T>(): Promise<T> {
    return new Promise<T>((r) => {
      this.resolveInvoke = r as (v: unknown) => void;
    });
  }
  onNotification<P>(method: string, h: (p: P) => void): () => void {
    const a = this.handlers.get(method) ?? [];
    a.push(h as (p: unknown) => void);
    this.handlers.set(method, a);
    return () => {
      this.handlers.set(
        method,
        (this.handlers.get(method) ?? []).filter((x) => x !== h),
      );
    };
  }
  emit(method: string, p: unknown): void {
    for (const h of this.handlers.get(method) ?? []) h(p);
  }
}

describe("ClusterIntegration.imagesCreate — progress forwarding", () => {
  it("forwards step/log events for its executionId and stops after completion", async () => {
    /* @Given a fake client and an in-flight imagesCreate collecting logs */
    const fake = new FakeClient();
    const ci = new ClusterIntegration(fake as unknown as Client);
    const logs: string[] = [];

    const promise = ci.imagesCreate(
      { sessionId: "s", clusterId: "c", nodeId: "n", imageId: "i" },
      (line) => logs.push(line),
    );

    /* @When the server emits step/log events for this executionId (and one for another) */
    fake.emit("operation.started", { executionId: "exec-1" });
    fake.emit("execution.event", {
      executionId: "exec-1",
      event: { type: "step", name: "download cloud image", detail: "skip if cached" },
    });
    fake.emit("execution.event", {
      executionId: "exec-1",
      event: { type: "log", line: "100%" },
    });
    // Different execution — must be ignored.
    fake.emit("execution.event", {
      executionId: "other",
      event: { type: "log", line: "NOPE" },
    });

    fake.resolveInvoke({});
    await promise;

    /* @Then only this execution's events were forwarded, in order */
    assertEquals(logs, ["▼ download cloud image — skip if cached", "100%"]);

    /* @And after completion subscriptions are cleaned up — later events do nothing */
    // Subscriptions cleaned up in finally — further events do nothing.
    fake.emit("execution.event", {
      executionId: "exec-1",
      event: { type: "log", line: "AFTER" },
    });
    assertEquals(logs.includes("AFTER"), false);
  });
});
