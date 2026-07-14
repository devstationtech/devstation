import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertThrows } from "@std/assert";
import { State } from "@server/cluster/domain/models/proxmox/nodes/state.ts";
import { InvalidNodeStateTransition } from "@server/cluster/domain/exceptions/invalid-node-state-transition.ts";
import { registerNode } from "@tests/cluster/fixtures/operations.ts";

describe("Node.state — initial state", () => {
  it("starts as REGISTERED when no state is provided", () => {
    /* @Given a freshly registered node */
    const node = registerNode();
    /* @Then its state is REGISTERED */
    assertEquals(node.state, State.REGISTERED);
  });
});

describe("Node.state — planning transitions", () => {
  it("REGISTERED → PLAN_STARTED via startPlan()", () => {
    /* @Given a registered node */
    /* @When startPlan() is called */
    const node = registerNode().startPlan();
    /* @Then it moves to PLAN_STARTED */
    assertEquals(node.state, State.PLAN_STARTED);
  });

  it("PLAN_STARTED → PLAN_SUCCEEDED via completePlan()", () => {
    /* @Given a node in PLAN_STARTED */
    /* @When completePlan() is called */
    const node = registerNode().startPlan().completePlan();
    /* @Then it moves to PLAN_SUCCEEDED */
    assertEquals(node.state, State.PLAN_SUCCEEDED);
  });

  it("PLAN_STARTED → PLAN_FAILED via failPlan()", () => {
    /* @Given a node in PLAN_STARTED */
    /* @When failPlan() is called */
    const node = registerNode().startPlan().failPlan();
    /* @Then it moves to PLAN_FAILED */
    assertEquals(node.state, State.PLAN_FAILED);
  });

  it("rejects completePlan() when not in PLAN_STARTED", () => {
    /* @Given a registered node that never started a plan */
    /* @When completePlan() is called out of order */
    /* @Then it throws an invalid-transition error */
    assertThrows(
      () => registerNode().completePlan(),
      InvalidNodeStateTransition,
      "REGISTERED → PLAN_SUCCEEDED",
    );
  });
});

describe("Node.state — provisioning transitions", () => {
  it("PLAN_SUCCEEDED → APPLY_STARTED → APPLY_SUCCEEDED", () => {
    /* @Given a node with a successful plan */
    /* @When apply is started and completed */
    const node = registerNode()
      .startPlan()
      .completePlan()
      .startApply()
      .completeApply();
    /* @Then it ends in APPLY_SUCCEEDED */
    assertEquals(node.state, State.APPLY_SUCCEEDED);
  });

  it("rejects startApply() from REGISTERED", () => {
    /* @Given a registered node with no plan */
    /* @When startApply() is called before planning */
    /* @Then it throws an invalid-transition error */
    assertThrows(
      () => registerNode().startApply(),
      InvalidNodeStateTransition,
      "REGISTERED → APPLY_STARTED",
    );
  });

  it("APPLY_STARTED → APPLY_FAILED via failApply()", () => {
    /* @Given a node in APPLY_STARTED */
    /* @When failApply() is called */
    const node = registerNode()
      .startPlan()
      .completePlan()
      .startApply()
      .failApply();
    /* @Then it moves to APPLY_FAILED */
    assertEquals(node.state, State.APPLY_FAILED);
  });
});

describe("Node.state — destroying transitions", () => {
  it("APPLY_SUCCEEDED → DESTROY_STARTED → DESTROY_SUCCEEDED", () => {
    /* @Given a fully applied node */
    /* @When destroy is started and completed */
    const node = registerNode()
      .startPlan()
      .completePlan()
      .startApply()
      .completeApply()
      .startDestroy()
      .completeDestroy();
    /* @Then it ends in DESTROY_SUCCEEDED */
    assertEquals(node.state, State.DESTROY_SUCCEEDED);
  });

  it("rejects startDestroy() from REGISTERED", () => {
    /* @Given a registered node with nothing provisioned */
    /* @When startDestroy() is called */
    /* @Then it throws an invalid-transition error */
    assertThrows(
      () => registerNode().startDestroy(),
      InvalidNodeStateTransition,
    );
  });

  it("DESTROY_SUCCEEDED → PLAN_STARTED (revive)", () => {
    /* @Given a node that was provisioned then destroyed */
    /* @When startPlan() revives it */
    const node = registerNode()
      .startPlan()
      .completePlan()
      .startApply()
      .completeApply()
      .startDestroy()
      .completeDestroy()
      .startPlan();
    /* @Then it returns to PLAN_STARTED */
    assertEquals(node.state, State.PLAN_STARTED);
  });
});

describe("Node.state — retry transitions", () => {
  it("PLAN_FAILED → PLAN_STARTED (retry plan)", () => {
    /* @Given a node whose plan failed */
    /* @When startPlan() retries */
    const node = registerNode().startPlan().failPlan().startPlan();
    /* @Then it returns to PLAN_STARTED */
    assertEquals(node.state, State.PLAN_STARTED);
  });

  it("APPLY_FAILED → APPLY_STARTED (retry provision)", () => {
    /* @Given a node whose apply failed */
    /* @When startApply() retries */
    const node = registerNode()
      .startPlan()
      .completePlan()
      .startApply()
      .failApply()
      .startApply();
    /* @Then it returns to APPLY_STARTED */
    assertEquals(node.state, State.APPLY_STARTED);
  });
});

/**
 * Regression: teardown must stay reachable from all intermediate states
 * so real infra is never stranded. These edges were proven missing by a
 * real provisioning cycle and are now pinned explicitly.
 */
describe("Node.state — F4 teardown reachability", () => {
  it("G1: PLAN_SUCCEEDED → DESTROY_STARTED (replan on live infra can still destroy)", () => {
    /* @Given live infra re-planned (provisioned, then a validation plan) */
    // exact cp4 scenario: provisioned, then a validation plan, then destroy
    const node = registerNode()
      .startPlan()
      .completePlan()
      .startApply()
      .completeApply()
      .startPlan()
      .completePlan()
      /* @When destroy is started from PLAN_SUCCEEDED */
      .startDestroy();
    /* @Then teardown is reachable and it moves to DESTROY_STARTED */
    assertEquals(node.state, State.DESTROY_STARTED);
  });

  it("G2: APPLY_FAILED → DESTROY_STARTED (clean up a partial apply)", () => {
    /* @Given a node whose apply failed (partial infra) */
    /* @When destroy is started to clean up */
    const node = registerNode()
      .startPlan()
      .completePlan()
      .startApply()
      .failApply()
      .startDestroy();
    /* @Then it moves to DESTROY_STARTED */
    assertEquals(node.state, State.DESTROY_STARTED);
  });

  it("G3: DESTROY_FAILED → PLAN_STARTED (re-plan to reconcile a stuck destroy)", () => {
    /* @Given a node whose destroy failed */
    /* @When startPlan() re-plans to reconcile */
    const node = registerNode()
      .startPlan()
      .completePlan()
      .startApply()
      .completeApply()
      .startDestroy()
      .failDestroy()
      .startPlan();
    /* @Then it returns to PLAN_STARTED */
    assertEquals(node.state, State.PLAN_STARTED);
  });

  it("still rejects DESTROY_SUCCEEDED → APPLY_STARTED (plan-before-apply kept)", () => {
    /* @Given a node that was destroyed successfully */
    const node = registerNode()
      .startPlan()
      .completePlan()
      .startApply()
      .completeApply()
      .startDestroy()
      .completeDestroy();
    /* @When startApply() is attempted without a fresh plan */
    /* @Then it throws, keeping the plan-before-apply invariant */
    assertThrows(
      () => node.startApply(),
      InvalidNodeStateTransition,
      "DESTROY_SUCCEEDED → APPLY_STARTED",
    );
  });

  // Bare transition errors can leave users guessing about the workflow.
  // Common transitions now carry an actionable remediation hint.
  it("appends a remediation hint for DESTROY_SUCCEEDED → APPLY_STARTED", () => {
    /* @Given a node that was destroyed successfully */
    const node = registerNode()
      .startPlan()
      .completePlan()
      .startApply()
      .completeApply()
      .startDestroy()
      .completeDestroy();
    /* @When startApply() is attempted out of order */
    try {
      node.startApply();
    } catch (e) {
      /* @Then the error keeps the bare prefix and adds an actionable hint */
      const msg = (e as Error).message;
      // Bare prefix preserved (back-compat for callers grepping it),
      // plus the actionable hint pointing at `provisioning_plan`.
      assertEquals(msg.includes("DESTROY_SUCCEEDED → APPLY_STARTED"), true);
      assertEquals(msg.includes("devstation_cluster_provisioning_plan"), true);
      assertEquals(msg.includes("apply requires a fresh plan after destroy"), true);
    }
  });

  it("appends a hint for the PLAN_STARTED → PLAN_STARTED stuck case", () => {
    /* @Given a PLAN_STARTED → PLAN_STARTED invalid transition */
    // Force-construct the exception directly because the state machine
    // wouldn't normally hit this from a fresh node (the rescue helper
    // exists for that). The exception message itself is the contract.
    const err = new InvalidNodeStateTransition(
      State.PLAN_STARTED,
      State.PLAN_STARTED,
    );
    /* @Then the message hints at acknowledge_interruption */
    assertEquals(err.message.includes("acknowledge_interruption"), true);
  });
});
