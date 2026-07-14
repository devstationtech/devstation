import { assert, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Blueprints } from "@server/blueprint/blueprints.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";

/**
 * Regression guard for the argocd first-install on a fresh k3s.
 *
 * `kubectl rollout status --timeout=<T>` does NOT get its full window if the
 * Deployment's own `progressDeadlineSeconds` (default 600s) trips first: the
 * controller marks the rollout failed and `rollout status` aborts immediately.
 * On a fresh single-node k3s the first image pull is slow enough to hit that
 * default, so the install must raise the deadline to at least the wait window
 * before waiting. This asserts the invariant `progressDeadlineSeconds >= wait`
 * so a future edit can't silently reintroduce the flake.
 */
describe("argocd blueprint — rollout deadline outlives the wait", () => {
  it("patches progressDeadlineSeconds to >= the rollout --timeout", async () => {
    const blueprints = await new Blueprints(new FileSystem("blueprints")).list();
    const argocd = blueprints.find((b) => b.name.value === "argocd");
    assertExists(argocd, "argocd blueprint must be in the catalog");

    const shell = argocd.installSteps.map((s) => s.shell).join("\n");

    const deadline = shell.match(/progressDeadlineSeconds"?\s*:\s*(\d+)/);
    const timeout = shell.match(/rollout status[^\n]*--timeout=(\d+)s/);
    assertExists(deadline, "install must patch progressDeadlineSeconds before waiting");
    assertExists(timeout, "install must wait via `rollout status --timeout=<n>s`");

    const deadlineSecs = Number(deadline[1]);
    const timeoutSecs = Number(timeout[1]);
    assert(
      deadlineSecs >= timeoutSecs,
      `progressDeadlineSeconds (${deadlineSecs}) must be >= rollout --timeout (${timeoutSecs}s), ` +
        `otherwise the Deployment self-aborts before the wait completes`,
    );
  });
});
