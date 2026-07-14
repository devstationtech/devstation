import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ProvisioningCli } from "@server/cluster/outbound/executions/proxmox/provisioning/runner.ts";
import { ProvisioningRuntimeNotInstalled } from "@server/cluster/outbound/executions/proxmox/provisioning/errors.ts";
import type { Process } from "@server/shared/process/domain/ports/outbound/process.ts";

/**
 * The engine MUST find tofu via either the operator override
 * (`$DEVSTATION_PROVISIONING_BINARY`) or the bundled sidecar
 * (`$DEVSTATION_SIDECAR_DIR/tofu(.exe)`). There is no PATH fallback —
 * zero-setup means the sidecar is the contract, and a missing sidecar
 * means a broken install.
 *
 * These tests guard against a regression where the engine silently
 * fell back to a PATH lookup that the user hadn't satisfied, causing
 * mysterious failures instead of a clear "binary not found" error.
 */

const noopProcess: Process = {
  run: async function* () {
    /* never called when constructor short-circuits */
  },
};

describe("ProvisioningCli resolver", () => {
  it("uses $DEVSTATION_PROVISIONING_BINARY when set", async () => {
    /* @Given the operator override $DEVSTATION_PROVISIONING_BINARY points at a custom binary */
    const sentinel = "/path/to/my-custom-tofu";
    const restore = withEnv({
      DEVSTATION_PROVISIONING_BINARY: sentinel,
      DEVSTATION_SIDECAR_DIR: "",
      DEVSTATION_STRICT_RESOLVER: "1",
    });
    try {
      /* @When the CLI resolves and runs */
      const cli = new ProvisioningCli(captureCommand());
      const captured = await drain(cli, { cwd: "/tmp", args: ["version"] });
      /* @Then it invokes exactly the override binary */
      assertEquals(captured.commandSeen, sentinel);
    } finally {
      restore();
    }
  });

  it("falls back to sidecar `$DEVSTATION_SIDECAR_DIR/tofu` on POSIX", async () => {
    if (Deno.build.os === "windows") return; // covered by separate Windows test
    /* @Given no override but a bundled sidecar tofu binary on disk */
    const tmp = await Deno.makeTempDir();
    const sidecar = `${tmp}/tofu`;
    await Deno.writeFile(sidecar, new Uint8Array([0x7f, 0x45, 0x4c, 0x46]));
    await Deno.chmod(sidecar, 0o755);

    const restore = withEnv({
      DEVSTATION_PROVISIONING_BINARY: "",
      DEVSTATION_SIDECAR_DIR: tmp,
      DEVSTATION_STRICT_RESOLVER: "1",
    });
    try {
      /* @When the CLI resolves and runs */
      const cli = new ProvisioningCli(captureCommand());
      const captured = await drain(cli, { cwd: "/tmp", args: ["version"] });
      /* @Then it invokes the sidecar binary */
      assertEquals(captured.commandSeen, sidecar);
    } finally {
      restore();
      await Deno.remove(tmp, { recursive: true });
    }
  });

  it("throws ProvisioningRuntimeNotInstalled when neither env nor sidecar is present", () => {
    /* @Given neither the override nor a sidecar is available */
    const restore = withEnv({
      DEVSTATION_PROVISIONING_BINARY: "",
      DEVSTATION_SIDECAR_DIR: "",
      DEVSTATION_STRICT_RESOLVER: "1",
    });
    try {
      const cli = new ProvisioningCli(noopProcess);
      /* @When the first run triggers lazy resolve */
      // First call triggers lazy resolve
      /* @Then it rejects with ProvisioningRuntimeNotInstalled */
      assertRejects(
        async () => {
          for await (const _ of cli.run({ cwd: "/tmp", args: ["version"] })) { /* drain */ }
        },
        ProvisioningRuntimeNotInstalled,
      );
    } finally {
      restore();
    }
  });

  it("error message lists what it searched", async () => {
    /* @Given a sidecar dir that exists but contains no tofu binary */
    const tmp = await Deno.makeTempDir(); // exists but no tofu file inside
    const restore = withEnv({
      DEVSTATION_PROVISIONING_BINARY: "",
      DEVSTATION_SIDECAR_DIR: tmp,
      DEVSTATION_STRICT_RESOLVER: "1",
    });
    try {
      const cli = new ProvisioningCli(noopProcess);
      /* @When resolution fails */
      const err = await assertRejects(
        async () => {
          for await (const _ of cli.run({ cwd: "/tmp", args: ["version"] })) { /* drain */ }
        },
        ProvisioningRuntimeNotInstalled,
      );
      /* @Then the error enumerates each location it searched */
      assertStringIncludes(err.message, "$DEVSTATION_PROVISIONING_BINARY (unset)");
      assertStringIncludes(err.message, "not found");
    } finally {
      restore();
      await Deno.remove(tmp, { recursive: true });
    }
  });
});

// --- helpers ---

function withEnv(vars: Record<string, string>): () => void {
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    previous[k] = Deno.env.get(k);
    if (v === "") Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  return () => {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  };
}

function captureCommand(): Process & { commandSeen?: string } {
  // deno-lint-ignore no-explicit-any
  const captured: any = {};
  captured.run = async function* (input: { command: string }) {
    captured.commandSeen = input.command;
    yield { type: "exit" as const, code: 0 };
  };
  return captured;
}

async function drain(
  cli: ProvisioningCli,
  opts: { cwd: string; args: string[] },
): Promise<{ commandSeen?: string }> {
  for await (const _ of cli.run(opts)) { /* drain */ }
  // deno-lint-ignore no-explicit-any
  return (cli as any).process as { commandSeen?: string };
}
