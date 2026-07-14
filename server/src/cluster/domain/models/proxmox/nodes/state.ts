/**
 * Lifecycle of a Node from registration through provisioning to teardown.
 *
 * Transitions are linear within each phase and only certain prior states
 * lead into each transition (enforced by Node):
 *
 *   REGISTERED        → PLAN_STARTED
 *   PLAN_STARTED      → PLAN_SUCCEEDED | PLAN_FAILED
 *   PLAN_SUCCEEDED    → APPLY_STARTED | PLAN_STARTED (re-plan)
 *   PLAN_FAILED       → PLAN_STARTED (retry)
 *   APPLY_STARTED     → APPLY_SUCCEEDED | APPLY_FAILED
 *   APPLY_SUCCEEDED   → DESTROY_STARTED | PLAN_STARTED (re-plan after change)
 *   APPLY_FAILED      → APPLY_STARTED (retry) | PLAN_STARTED (re-plan)
 *   DESTROY_STARTED   → DESTROY_SUCCEEDED | DESTROY_FAILED
 *   DESTROY_SUCCEEDED → PLAN_STARTED (revive)
 *   DESTROY_FAILED    → DESTROY_STARTED (retry)
 */
export enum State {
  REGISTERED = "REGISTERED",
  PLAN_STARTED = "PLAN_STARTED",
  PLAN_SUCCEEDED = "PLAN_SUCCEEDED",
  PLAN_FAILED = "PLAN_FAILED",
  APPLY_STARTED = "APPLY_STARTED",
  APPLY_SUCCEEDED = "APPLY_SUCCEEDED",
  APPLY_FAILED = "APPLY_FAILED",
  DESTROY_STARTED = "DESTROY_STARTED",
  DESTROY_SUCCEEDED = "DESTROY_SUCCEEDED",
  DESTROY_FAILED = "DESTROY_FAILED",
}
