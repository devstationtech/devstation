import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

/**
 * Clone mode is no longer hardcoded. The VM module exposes a `full`
 * variable and the clone block is `full = var.full`. The engine
 * resolves it per target storage (CoW → linked/false; non-CoW/unknown
 * → full/true) with a per-connection override; the module default is
 * `true` (full clone is universal — linked is opt-in via auto-detect).
 * Guards against a silent revert to a hardcoded clone mode.
 */
const MAIN_TF = new URL(
  "../../../src/cluster/outbound/executions/proxmox/provisioning/templates/modules/vm/main.tf",
  import.meta.url,
);
const VARIABLES_TF = new URL(
  "../../../src/cluster/outbound/executions/proxmox/provisioning/templates/modules/vm/variables.tf",
  import.meta.url,
);

describe("vm module provisioning template — clone strategy", () => {
  it("parameterizes the clone mode via var.full (no hardcoded full=true/false)", async () => {
    /* @When the vm module main.tf is read */
    const tf = await Deno.readTextFile(MAIN_TF);
    /* @Then the clone mode is driven by var.full with no hardcoded literal */
    assertStringIncludes(tf, "full = var.full");
    assertEquals(/\bfull\s*=\s*(true|false)\b/.test(tf), false);
  });

  it("declares the full variable defaulting to true (universal-safe)", async () => {
    /* @When the vm module variables.tf is read */
    const vars = await Deno.readTextFile(VARIABLES_TF);
    /* @Then the `full` variable exists and defaults to true */
    assertStringIncludes(vars, 'variable "full"');
    assertStringIncludes(vars, "default     = true");
  });

  /**
   * Regression: clone-created VMs can cause the provider to read
   * `boot_order` back empty, so every plan re-adds "scsi0" in-place
   * and the topology never converges to "no changes" (perpetual diff).
   * The fix is `boot_order` inside `lifecycle.ignore_changes`. Guards
   * against a silent revert that would bring the perpetual diff back.
   */
  it("ignores boot_order drift so plan stays idempotent on clones", async () => {
    /* @When the vm module main.tf is read */
    const tf = await Deno.readTextFile(MAIN_TF);
    // closing `]` is on its own indented line — anchor to it so the
    // inline `initialization[0]...` brackets don't end the match early.
    const ignore = tf.match(/ignore_changes\s*=\s*\[([\s\S]*?)\n\s*\]/);
    /* @Then lifecycle.ignore_changes includes boot_order */
    assertEquals(ignore !== null, true);
    assertStringIncludes(ignore![1], "boot_order");
  });
});
