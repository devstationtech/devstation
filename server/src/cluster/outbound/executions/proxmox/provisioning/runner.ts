import { join } from "node:path";
import { executableName } from "@server/shared/platform/executables.ts";
import type { Process } from "@server/shared/process/domain/ports/outbound/process.ts";
import { ProcessNotFound } from "@server/shared/process/domain/ports/outbound/process.ts";
import {
  ProvisioningExecutionFailed,
  ProvisioningRuntimeNotInstalled,
} from "@server/cluster/outbound/executions/proxmox/provisioning/errors.ts";

export type RunOptions = {
  cwd: string;
  args: string[];
  env?: Record<string, string>;
  signal?: AbortSignal;
};

export type RunEvent =
  | { type: "log"; line: string }
  | { type: "done"; code: number; stdout: string; stderr: string };

/**
 * Resolves the provisioning runtime binary path. Resolution order,
 * first hit wins:
 *
 *   1. `$DEVSTATION_PROVISIONING_BINARY` — operator escape hatch to pin
 *      a path or a specific build of the IaC runtime.
 *   2. `$DEVSTATION_SIDECAR_DIR/<runtime>` — the bundled sidecar. In
 *      compiled binaries the wrapper extracts the embedded runtime into
 *      `${DEVSTATION_HOME}/runtime/<VERSION>/` and points this env var
 *      at that dir before spawning the engine.
 *   3. Dev fallback (only when running directly via `deno run`,
 *      i.e. `execPath` is `deno`): the runtime on PATH. Compiled
 *      binaries never reach this branch because step 2 always sets the
 *      sidecar dir. Tests can disable the fallback by setting
 *      `DEVSTATION_STRICT_RESOLVER=1`.
 *   4. Throw `ProvisioningRuntimeNotInstalled` with the searched paths.
 *
 * The bundled runtime is OpenTofu; the on-disk binary is named `tofu`
 * (an implementation artifact of the build, kept here as the physical
 * filename). The rest of the codebase stays tool-agnostic.
 */
function resolveBinary(): string {
  const searched: string[] = [];

  // `$DEVSTATION_PROVISIONING_BINARY` is the operator escape hatch (pin
  // a path, or a specific build of the IaC runtime).
  const override = Deno.env.get("DEVSTATION_PROVISIONING_BINARY")?.trim();
  if (override) return override;
  searched.push("$DEVSTATION_PROVISIONING_BINARY (unset)");

  const sidecarDir = Deno.env.get("DEVSTATION_SIDECAR_DIR")?.trim();
  if (sidecarDir) {
    const exe = executableName("tofu");
    const candidate = join(sidecarDir, exe);
    try {
      Deno.statSync(candidate);
      return candidate;
    } catch {
      // Sidecar dir was set but the binary isn't there — broken
      // install / corrupted runtime dir. Fail loud (don't fall through
      // to PATH; the user explicitly opted into a sidecar location).
      searched.push(`${candidate} (not found)`);
      throw new ProvisioningRuntimeNotInstalled(searched);
    }
  }
  searched.push("$DEVSTATION_SIDECAR_DIR (unset)");

  // Dev fallback: running the engine via `deno run` (no compiled
  // wrapper, no embedded asset extraction). The compiled wrapper
  // always sets DEVSTATION_SIDECAR_DIR, so production never reaches
  // this branch. Tests opt out via DEVSTATION_STRICT_RESOLVER.
  if (!Deno.env.get("DEVSTATION_STRICT_RESOLVER")) {
    const execPath = Deno.execPath();
    if (/(?:^|[\\/])deno(\.exe)?$/i.test(execPath)) {
      return "tofu";
    }
  }

  throw new ProvisioningRuntimeNotInstalled(searched);
}

export class ProvisioningCli {
  // Resolved lazily on first use so the constructor doesn't throw in
  // dev/test environments that never call `run` (e.g. wiring tests).
  private cachedBinary: string | null = null;
  private get binary(): string {
    if (this.cachedBinary === null) this.cachedBinary = resolveBinary();
    return this.cachedBinary;
  }

  constructor(private readonly process: Process) {}

  async *run(options: RunOptions): AsyncIterable<RunEvent> {
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    let code = 0;

    try {
      for await (
        const event of this.process.run({
          command: this.binary,
          args: options.args,
          cwd: options.cwd,
          env: options.env,
          signal: options.signal,
        })
      ) {
        if (event.type === "stdout") {
          stdoutChunks.push(event.line);
          yield { type: "log", line: event.line };
        } else if (event.type === "stderr") {
          stderrChunks.push(event.line);
          yield { type: "log", line: event.line };
        } else {
          code = event.code;
        }
      }
    } catch (error) {
      if (error instanceof ProcessNotFound) {
        // The resolver succeeded (path existed at startup) but the
        // process couldn't be spawned — most likely the file vanished
        // mid-run. Surface the same not-installed error.
        throw new ProvisioningRuntimeNotInstalled([this.binary + " (process spawn failed)"]);
      }
      throw error;
    }

    yield {
      type: "done",
      code,
      stdout: stdoutChunks.join("\n"),
      stderr: stderrChunks.join("\n"),
    };
  }

  async *runOrThrow(action: string, options: RunOptions): AsyncIterable<RunEvent> {
    for await (const event of this.run(options)) {
      if (event.type === "done" && event.code !== 0) {
        throw new ProvisioningExecutionFailed(action, event.stderr || event.stdout);
      }
      yield event;
    }
  }
}
