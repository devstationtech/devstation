import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  abortRun,
  getState,
  type ProvisioningDeps,
  startApply,
  startPlan,
} from "@ui/cluster/providers/proxmox/provisioning-store.ts";

/**
 * Regression: a plan that fails must surface an error and stop the
 * spinner. The bug: the UI only watched the execution-stream terminal;
 * when that terminal never arrived (hung/missing) the screen span
 * forever — even though the cluster reliably emits a
 * `node-plan-failed` domain event the UI already receives.
 */

// Execution watch that never yields and never ends — simulates the
// hung/missing terminal that used to trap the UI.
const hungOperations = {
  watch: () => ({
    [Symbol.asyncIterator]: () => ({ next: () => new Promise<never>(() => {}) }),
  }),
};

function depsWith(clusterEventsWatch: () => AsyncIterable<unknown>): ProvisioningDeps {
  return {
    sessionId: "s",
    cluster: {
      provisioningPlan: () => Promise.resolve({ executionId: "e1" }),
    },
    clusterEvents: { watch: clusterEventsWatch },
    operations: hungOperations,
  } as unknown as ProvisioningDeps;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const guard = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error("timed out — UI still trapped")), ms);
  });
  return Promise.race([p, guard]).finally(() => clearTimeout(timer)) as Promise<T>;
}

// The store schedules an internal 100ms log-flush timer and the
// scenarios deliberately use hung streams — both are the behavior under
// test, so op/resource sanitizers are disabled for the whole suite.
describe("provisioning-store — failure surfacing", {
  sanitizeOps: false,
  sanitizeResources: false,
}, () => {
  // The simulated hung execution watch deliberately never resolves and
  // the store schedules an internal log-flush timer — both are the
  // scenario under test, so the op/resource sanitizers are disabled.
  it("transitions to error on a node-plan-failed event despite a hung terminal", {
    sanitizeOps: false,
    sanitizeResources: false,
  }, async () => {
    /* @Given a plan whose execution terminal hangs but a node-plan-failed event arrives */
    const clusterId = `c-${crypto.randomUUID()}`;
    const deps = depsWith(async function* () {
      yield { type: "node-plan-failed", clusterId, nodeId: "n1" };
    });

    /* @When the plan runs */
    // FAIL_DRAIN_MS (2s) elapses before the generic message is thrown
    // when the terminal is hung — allow headroom.
    await withTimeout(startPlan(deps, clusterId, ["n1"]), 8000);

    /* @Then the store transitions to error and clears the runId */
    const s = getState(clusterId);
    assertEquals(s.phase, "error");
    assertStringIncludes(s.error, "planning failed");
    assertEquals(s.runId, null);
  });

  it("transitions to done when every expected node completes despite a hung terminal", {
    sanitizeOps: false,
    sanitizeResources: false,
  }, async () => {
    /* @Given a plan whose terminal hangs but every node emits node-plan-succeeded */
    const clusterId = `c-${crypto.randomUUID()}`;
    const deps = depsWith(async function* () {
      yield { type: "node-plan-succeeded", clusterId, nodeId: "n1" };
    });

    /* @When the plan runs */
    await withTimeout(startPlan(deps, clusterId, ["n1"]), 8000);

    /* @Then the store transitions to done and clears the runId */
    const s = getState(clusterId);
    assertEquals(s.phase, "done");
    assertEquals(s.runId, null);
  });

  it("honors a cancel pressed during the pre-apply image phase", {
    sanitizeOps: false,
    sanitizeResources: false,
  }, async () => {
    /* @Given an apply paused on the pre-apply image phase */
    const clusterId = `c-${crypto.randomUUID()}`;
    const img = Promise.withResolvers<unknown>();
    let applyCalled = false;
    const deps = {
      sessionId: "s",
      cluster: {
        imagesCreate: () => img.promise,
        provisioningApply: () => {
          applyCalled = true;
          return Promise.resolve({ executionId: "e1" });
        },
      },
      clusterEvents: {
        watch: () => ({
          [Symbol.asyncIterator]: () => ({ next: () => new Promise<never>(() => {}) }),
        }),
      },
      operations: { cancel: () => Promise.resolve({}) },
    } as unknown as ProvisioningDeps;

    const run = startApply(deps, clusterId, ["n1"], [
      { nodeId: "n1", nodeName: "cp4", imageId: "i", imageName: "ubuntu-24-04" },
    ]);
    // Let startApply reach the imagesCreate await (no runId yet).
    await new Promise((r) => setTimeout(r, 0));

    /* @When the user cancels during the image phase */
    // First cancel, during the image phase — must give feedback.
    await abortRun(deps, clusterId);
    assertEquals(getState(clusterId).aborting, true);

    img.resolve({}); // image step completes; startApply must NOT proceed
    await withTimeout(run, 4000);

    /* @Then apply is never reached and the run ends aborted with feedback */
    assertEquals(applyCalled, false);
    const s = getState(clusterId);
    assertEquals(s.phase, "error");
    assertStringIncludes(s.error, "aborted");
    assertStringIncludes(s.log.join("\n"), "aborting run");
  });
});
