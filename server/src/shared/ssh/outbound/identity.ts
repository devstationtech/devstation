import { join } from "node:path";
import type { Process } from "@server/shared/process/domain/ports/outbound/process.ts";

/**
 * The SSH identity used by every automated operation (provisioning,
 * install, image transfer). Persisted under `~/.ssh/devstation_ed25519`
 * so OpenSSH tooling (`ssh`, `ssh-add`, `ssh-copy-id`) finds it by
 * default — the user can `ssh -i ~/.ssh/devstation_ed25519 user@host`
 * manually without any extra flags.
 *
 * Single shared key across the whole CLI (one per workstation, not
 * per-cluster). Per-cluster keys were evaluated and rejected as
 * overengineering for the alpha — if the key is compromised the user
 * regenerates one and `ssh-copy-id` to every host. The public key is
 * the bootstrap artifact the user (or provisioning cloud-init) drops into
 * each remote's `~/.ssh/authorized_keys`.
 *
 * Generation is lazy + idempotent: first call to `ensureIdentity()`
 * runs `ssh-keygen -t ed25519`; subsequent calls reuse the file.
 */
const KEY_FILENAME = "devstation_ed25519";

export class IdentityProvider {
  constructor(
    private readonly homeDir: string,
    private readonly process: Process,
  ) {}

  /**
   * Absolute path of the private key. Creates the key on first call.
   * Returns the same path every time afterwards.
   */
  async ensureIdentity(): Promise<string> {
    const dir = join(this.homeDir, ".ssh");
    const keyPath = join(dir, KEY_FILENAME);

    if (await this.exists(keyPath)) return keyPath;

    await Deno.mkdir(dir, { recursive: true, mode: 0o700 });
    if (Deno.build.os !== "windows") {
      // POSIX requires ~/.ssh to be 0700 or sshd refuses to use the
      // keys inside. Windows ACLs are different; skip the chmod.
      await Deno.chmod(dir, 0o700);
    }

    // -N "" → no passphrase. -C tag identifies devstation keys when
    // the user inspects `~/.ssh` or audits `authorized_keys`.
    //
    // A previous investigation revealed that bootstrap could hang
    // 90s+ with no `ssh-bootstrap: connecting` trace at all — proving
    // the hang lived upstream of the ssh adapter. On Windows, ssh-keygen
    // is the likely culprit (PATH lookup edge cases, stdin wait if argv
    // parsing decides it needs a passphrase prompt, or an antivirus
    // intercept). The hard 30s ceiling keeps the failure mode visible —
    // ed25519 generation is millisecond-fast on any modern machine.
    let exitCode = 0;
    const stderr: string[] = [];
    // `-q` keeps stdout quiet (we only need exit code). The Process
    // adapter forces `stdin:"null"` so any prompt fails fast with EOF
    // instead of hanging — this prevents ssh-keygen from blocking
    // indefinitely when it tries to read a passphrase from stdin.
    trace(`ssh-identity: spawning ssh-keygen -> ${keyPath}`);
    await withTimeout(
      (async () => {
        for await (
          const event of this.process.run({
            command: "ssh-keygen",
            args: [
              "-q",
              "-t",
              "ed25519",
              "-f",
              keyPath,
              "-N",
              "",
              "-C",
              "devstation-cli",
            ],
          })
        ) {
          if (event.type === "stderr") stderr.push(event.line);
          if (event.type === "exit") exitCode = event.code;
        }
      })(),
      30_000,
      "ssh-keygen spawn stalled",
    );
    trace(`ssh-identity: ssh-keygen exit=${exitCode}`);
    if (exitCode !== 0) {
      throw new Error(
        `ssh-keygen failed (exit ${exitCode}): ${stderr.join("\n")}`,
      );
    }
    return keyPath;
  }

  /**
   * Public key contents (PEM/OpenSSH single-line) — what the user (or
   * cloud-init in fresh VMs) appends to a remote's `authorized_keys`.
   */
  async publicKey(): Promise<string> {
    const keyPath = await this.ensureIdentity();
    return (await Deno.readTextFile(`${keyPath}.pub`)).trim();
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await Deno.stat(path);
      return true;
    } catch {
      return false;
    }
  }
}

function withTimeout<T>(
  inner: Promise<T>,
  ms: number,
  what: string,
): Promise<T> {
  // ReturnType<typeof setTimeout> keeps the helper portable across Deno
  // (returns `number`) and Node-flavored runtimes (returns NodeJS.Timeout);
  // CI surfaces the Node typing once any npm dependency pulls in @types/node.
  let handle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(() => reject(new Error(`${what} after ${ms}ms`)), ms);
  });
  return Promise.race([inner, timeout]).finally(() => {
    if (handle !== undefined) clearTimeout(handle);
  });
}

function trace(message: string): void {
  try {
    Deno.stderr.writeSync(new TextEncoder().encode(`${message}\n`));
  } catch {
    // never let logging break identity resolution
  }
}
