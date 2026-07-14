import type {
  Process,
  ProcessEvent,
  ProcessRequest,
} from "@server/shared/process/domain/ports/outbound/process.ts";
import { ProcessNotFound } from "@server/shared/process/domain/ports/outbound/process.ts";

/**
 * Detects "executable not found" across both throw shapes Deno uses:
 *   - POSIX / construction time → `Deno.errors.NotFound`
 *   - Windows / spawn time → generic Error with message like
 *     `Failed to spawn '<cmd>': entity not found (os error 2)`.
 *     ENOENT / "system cannot find the file" variants are also tolerated.
 *
 * Without this mapping, a spawn error for a missing executable reaches the
 * user as a raw string instead of being mapped to the actionable
 * `ProvisioningRuntimeNotInstalled`.
 */
function isExecutableNotFound(error: unknown): boolean {
  if (error instanceof Deno.errors.NotFound) return true;
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("entity not found") ||
    msg.includes("enoent") ||
    msg.includes("cannot find the file") ||
    msg.includes("não foi possível encontrar") || // pt-BR
    msg.includes("no such file or directory");
}

export class DenoCommandProcess implements Process {
  async *run(request: ProcessRequest): AsyncIterable<ProcessEvent> {
    let cmd: Deno.Command;
    try {
      cmd = new Deno.Command(request.command, {
        args: request.args,
        cwd: request.cwd,
        env: request.env,
        signal: request.signal,
        stdout: "piped",
        stderr: "piped",
        // Closing stdin is critical when the engine runs in MCP stdio
        // mode: its own stdin IS the JSON-RPC stream from the client.
        // Without `stdin:"null"`, every child process inherits that
        // stream — any child that prompts (e.g. `ssh-keygen` asking
        // "Overwrite (y/n)?", or asking for a passphrase) blocks
        // indefinitely waiting on input that will never come.
        // None of our current consumers (ssh-keygen, ssh, ps/wmic,
        // provisioning runtime) need interactive stdin — they're all
        // one-shot. The one exception is an explicit `request.stdin`
        // payload: SshCli ships install scripts that way so secrets
        // stay out of argv. Those children get a piped stdin, written
        // once and closed — never the parent's stream.
        stdin: request.stdin !== undefined ? "piped" : "null",
      });
    } catch (error) {
      if (isExecutableNotFound(error)) throw new ProcessNotFound(request.command);
      throw error;
    }

    let child;
    try {
      child = cmd.spawn();
    } catch (error) {
      // On Windows, `Deno.Command(missing).spawn()` throws
      // `Failed to spawn '<cmd>': entity not found` from inside
      // `spawn()` rather than at construction. On Linux the error is
      // `Deno.errors.NotFound` at construction time. Catch both.
      if (isExecutableNotFound(error)) throw new ProcessNotFound(request.command);
      throw error;
    }

    // Feed the payload concurrently with output draining — a child that
    // emits before consuming all of stdin must not deadlock either side.
    // A child that exits without reading (fast failure) breaks the pipe;
    // that's not an error here — the exit event carries the real outcome.
    const stdinDone = request.stdin !== undefined
      ? (async () => {
        const writer = child.stdin.getWriter();
        try {
          await writer.write(new TextEncoder().encode(request.stdin));
          await writer.close();
        } catch {
          // broken pipe / already closed — surfaced via the exit code
        }
      })()
      : Promise.resolve();

    const decoder = new TextDecoder();

    const stream = new ReadableStream<ProcessEvent>({
      async start(controller) {
        async function pipe(stream: ReadableStream<Uint8Array>, type: "stdout" | "stderr") {
          const reader = stream.getReader();
          let buffer = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              let nl = buffer.indexOf("\n");
              while (nl !== -1) {
                controller.enqueue({ type, line: buffer.slice(0, nl) });
                buffer = buffer.slice(nl + 1);
                nl = buffer.indexOf("\n");
              }
            }
            if (buffer.length > 0) controller.enqueue({ type, line: buffer });
          } finally {
            reader.releaseLock();
          }
        }

        await Promise.all([
          pipe(child.stdout, "stdout"),
          pipe(child.stderr, "stderr"),
          stdinDone,
        ]);
        const status = await child.status;
        controller.enqueue({ type: "exit", code: status.code });
        controller.close();
      },
    });

    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }
}
