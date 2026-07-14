import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  parseApplyStats,
  parseDestroyStats,
} from "@server/cluster/outbound/executions/proxmox/provisioning/output-parser.ts";

describe("parseApplyStats", () => {
  it("should extract counts from apply output", () => {
    /* @Given provisioning apply output */
    const output = `
Apply complete! ProxmoxResources: 3 added, 1 changed, 2 destroyed.

Outputs:
`;
    /* @When parsed */
    const stats = parseApplyStats(output);
    /* @Then the counters should reflect the output */
    assertEquals(stats, { created: 3, updated: 1, deleted: 2 });
  });

  it("should return zeros when pattern not found", () => {
    /* @Given an output without the Apply complete line */
    const output = "Something went wrong";
    /* @When parsed */
    const stats = parseApplyStats(output);
    /* @Then it returns zeros */
    assertEquals(stats, { created: 0, updated: 0, deleted: 0 });
  });
});

describe("parseDestroyStats", () => {
  it("should extract destroyed count", () => {
    /* @Given provisioning destroy output */
    const output = "Destroy complete! ProxmoxResources: 4 destroyed.";
    /* @When parsed */
    const stats = parseDestroyStats(output);
    /* @Then it should return 4 */
    assertEquals(stats, { deleted: 4 });
  });

  it("should return zero when pattern not found", () => {
    /* @Given an output without the line */
    const output = "error: nothing to destroy";
    /* @When parsed */
    const stats = parseDestroyStats(output);
    /* @Then it returns zero */
    assertEquals(stats, { deleted: 0 });
  });
});
