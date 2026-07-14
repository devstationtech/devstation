import { assertArrayIncludes, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  provisioningApplyArgs,
  provisioningDestroyArgs,
} from "@server/cluster/outbound/executions/proxmox/provisioning/provisioning-adapter.ts";

/**
 * Parallelism is configurable per connection. Default stays `1`
 * (serial — a weak Proxmox node can time out the API under concurrent
 * qmclone + polling); a stronger node can raise it.
 */
describe("provisioning apply/destroy args", () => {
  it("apply defaults to serial and non-interactive", () => {
    /* @When apply args are built with no parallelism configured */
    const args = provisioningApplyArgs();
    /* @Then they default to serial (-parallelism=1) and non-interactive */
    assertEquals(args[0], "apply");
    assertArrayIncludes(args, ["-input=false", "-auto-approve", "-parallelism=1"]);
  });

  it("destroy defaults to serial and non-interactive", () => {
    /* @When destroy args are built with no parallelism configured */
    const args = provisioningDestroyArgs();
    /* @Then they default to serial (-parallelism=1) and non-interactive */
    assertEquals(args[0], "destroy");
    assertArrayIncludes(args, ["-input=false", "-auto-approve", "-parallelism=1"]);
  });

  it("honors a configured parallelism", () => {
    /* @Given an explicit parallelism */
    /* @Then it is reflected in both apply and destroy args */
    assertArrayIncludes(provisioningApplyArgs(4), ["-parallelism=4"]);
    assertArrayIncludes(provisioningDestroyArgs(8), ["-parallelism=8"]);
  });
});
