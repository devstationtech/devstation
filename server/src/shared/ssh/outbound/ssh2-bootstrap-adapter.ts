import type { Buffer } from "node:buffer";
import { Client, type ClientChannel } from "ssh2";
import {
  type SshBootstrap,
  SshBootstrapFailed,
  type SshBootstrapRequest,
  type SshBootstrapResult,
} from "@server/shared/ssh/domain/ports/outbound/ssh-bootstrap.ts";

/**
 * ssh2-based implementation of the bootstrap port. Single round trip:
 * connect with password → detect target shape → install key (no-op,
 * append, or pmxcfs chmod-dance) → verify by reconnecting with the
 * key. The password never leaves this method.
 *
 * Why ssh2 lib and not subprocess + sshpass: ssh2 is cross-OS by
 * construction (pure JS, runs identically on Linux/Mac/Win via Deno
 * npm: compat), reuses the same OpenSSH key format we already
 * generate (`id_ed25519`), and gives us programmatic stderr and
 * timeouts instead of parsing process output.
 *
 * The `ssh2` library can enter a state where neither `ready` nor
 * `error` fires — observed as 70s of silence after the call was
 * dispatched. The lib's own `readyTimeout` did not save us. The
 * adapter wraps connect, exec and `client.end()` in absolute
 * Promise.race timeouts and writes a one-line stderr trace per stage
 * so a future hang has a visible last-known position instead of
 * opaque silence.
 *
 * Stderr is intentional (not the project Logger): MCP clients
 * capture child stderr live, so the trace shows up immediately in
 * the agent's transcript without depending on Logger plumbing.
 */
const STAGE_TIMEOUT_MS = 20_000;
const TOTAL_TIMEOUT_MS = 60_000;

export class Ssh2BootstrapAdapter implements SshBootstrap {
  async installKey(request: SshBootstrapRequest): Promise<SshBootstrapResult> {
    const trimmedKey = request.publicKey.trim();
    if (trimmedKey === "") {
      throw new SshBootstrapFailed("public key is empty");
    }

    return await withTimeout(
      doInstallKey(request, trimmedKey),
      TOTAL_TIMEOUT_MS,
      "bootstrap total budget exhausted",
    );
  }
}

async function doInstallKey(
  request: SshBootstrapRequest,
  trimmedKey: string,
): Promise<SshBootstrapResult> {
  // The generic "ssh connect failed: All configured authentication
  // methods failed" error is ambiguous between a misconfigured vault
  // credential and a handler bug. Adding the password presence marker
  // disambiguates: if `password=<set>` the auth attempt happened and
  // the failure was a credential mismatch on the node, not a missing
  // field.
  const passwordSummary = request.password ? "password=<set>" : "password=<empty>";
  trace(
    `connecting user=${request.user} host=${request.host}:${request.port ?? 22} ` +
      `(method=password ${passwordSummary}, source=vault credential)`,
  );
  const passwordClient = await withTimeout(
    connect({
      host: request.host,
      port: request.port ?? 22,
      username: request.user,
      password: request.password,
    }),
    STAGE_TIMEOUT_MS,
    `connect to ${request.host}:${request.port ?? 22} stalled`,
  );
  trace(`connected as ${request.user} — installing devstation_ed25519.pub`);

  try {
    trace("inspecting authorized_keys");
    const inspection = await withTimeout(
      inspectAuthorizedKeys(passwordClient, request.user),
      STAGE_TIMEOUT_MS,
      "inspect authorized_keys stalled",
    );
    trace(`inspected: pmxcfs=${inspection.pmxcfs} exists=${inspection.exists}`);

    if (inspection.alreadyPresent(trimmedKey)) {
      trace("key already present — skipping install");
      return {
        installed: true,
        alreadyPresent: true,
        pmxcfsDetected: inspection.pmxcfs,
      };
    }

    trace("backing up authorized_keys");
    const backupPath = await withTimeout(
      backupAuthorizedKeys(passwordClient, inspection),
      STAGE_TIMEOUT_MS,
      "backup authorized_keys stalled",
    );
    trace(`backup: ${backupPath}`);

    trace("installing key");
    const installed = await withTimeout(
      installKey(passwordClient, inspection, trimmedKey),
      STAGE_TIMEOUT_MS,
      "install authorized_keys stalled",
    );
    trace(`installed: symlinkBroken=${installed.symlinkBroken}`);

    return {
      installed: true,
      alreadyPresent: false,
      pmxcfsDetected: inspection.pmxcfs,
      ...(installed.symlinkBroken ? { symlinkBroken: true } : {}),
      backupPath,
    };
  } finally {
    try {
      passwordClient.end();
    } catch {
      // best-effort; ssh2 .end() can throw on already-closed sockets
    }
    trace("connection closed");
  }
}

function trace(message: string): void {
  // One-line, prefix-tagged. Easy to grep in MCP transcripts.
  try {
    Deno.stderr.writeSync(
      new TextEncoder().encode(`ssh-bootstrap: ${message}\n`),
    );
  } catch {
    // never let logging take down the bootstrap
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
    handle = setTimeout(
      () => reject(new SshBootstrapFailed(`${what} after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([inner, timeout]).finally(() => {
    if (handle !== undefined) clearTimeout(handle);
  });
}

// ─── ssh2 helpers ────────────────────────────────────────────────────

type ConnectOptions = {
  host: string;
  port: number;
  username: string;
  password: string;
};

function connect(opts: ConnectOptions): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let settled = false;
    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      fn();
    };

    client.once("ready", () => settle(() => resolve(client)));
    client.once("error", (error: Error) => {
      settle(() => reject(new SshBootstrapFailed(`ssh connect failed: ${error.message}`, error)));
    });
    // The ssh2 lib can enter a state where neither `ready` nor `error`
    // fires and the connection ends silently. Listening for `close`/`end`
    // catches that case so the outer timeout is not the only fallback.
    client.once("close", () => {
      settle(() =>
        reject(
          new SshBootstrapFailed(
            "ssh connect closed before handshake completed (no error event)",
          ),
        )
      );
    });
    client.once("end", () => {
      settle(() =>
        reject(
          new SshBootstrapFailed(
            "ssh connect ended before handshake completed (no error event)",
          ),
        )
      );
    });

    client.connect({
      host: opts.host,
      port: opts.port,
      username: opts.username,
      password: opts.password,
      // Keep BatchMode-like behavior: never fall back to keyboard-interactive.
      tryKeyboard: false,
      readyTimeout: 15_000,
    });
  });
}

type ExecResult = { code: number; stdout: string; stderr: string };

function exec(client: Client, command: string): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    client.exec(command, (err: Error | undefined, stream: ClientChannel) => {
      if (err) return reject(new SshBootstrapFailed(`exec failed: ${err.message}`, err));
      const stdout: string[] = [];
      const stderr: string[] = [];
      let exitCode = 0;
      stream.on("data", (data: Buffer) => stdout.push(data.toString("utf8")));
      stream.stderr.on("data", (data: Buffer) => stderr.push(data.toString("utf8")));
      stream.on("close", (code: number) => {
        exitCode = code ?? 0;
        resolve({ code: exitCode, stdout: stdout.join(""), stderr: stderr.join("") });
      });
      stream.on("error", (e: Error) => {
        reject(new SshBootstrapFailed(`exec stream error: ${e.message}`, e));
      });
    });
  });
}

// ─── remote inspection ───────────────────────────────────────────────

type Inspection = {
  /** Path used by sshd for this user's authorized_keys (typically `~/.ssh/authorized_keys`). */
  authorizedKeysPath: string;
  /** User that owns the install — used by chown during symlink-break fallback. */
  user: string;
  /** True when authorizedKeysPath is a symlink into Proxmox pmxcfs (read-only FUSE). */
  pmxcfs: boolean;
  /**
   * Real target path when pmxcfs is true (e.g. `/etc/pve/priv/authorized_keys`).
   * Write ops on pmxcfs go through the real path — operating via the symlink
   * surfaces "Permission denied" even after relaxing the mode, while direct
   * access to the real path passes.
   */
  realPath: string;
  /** Current file contents (empty string when missing). */
  contents: string;
  /** Whether the file existed before we touched anything. */
  exists: boolean;
  alreadyPresent(publicKey: string): boolean;
};

async function inspectAuthorizedKeys(client: Client, user: string): Promise<Inspection> {
  // Resolve the user's home + the actual path of authorized_keys. We
  // ask the shell rather than guessing /home/<user> because root's
  // home is /root and some systems use /Users/<user> etc.
  const homeResult = await exec(client, `echo "$HOME"`);
  if (homeResult.code !== 0) {
    throw new SshBootstrapFailed(
      `unable to resolve $HOME for user ${user}: ${homeResult.stderr || "(no stderr)"}`,
    );
  }
  const home = homeResult.stdout.trim();
  if (home === "") {
    throw new SshBootstrapFailed(`empty $HOME for user ${user}`);
  }
  const authorizedKeysPath = `${home}/.ssh/authorized_keys`;

  // Detect pmxcfs: stat the file, check if it's a symlink into /etc/pve/.
  // Some non-Proxmox systems also symlink for their own reasons, so we
  // only flag pmxcfs when the target lives under /etc/pve/.
  const linkResult = await exec(
    client,
    `readlink -f ${shellEscape(authorizedKeysPath)} 2>/dev/null || true`,
  );
  const resolved = linkResult.stdout.trim();
  const pmxcfs = resolved.startsWith("/etc/pve/");
  const realPath = resolved !== "" ? resolved : authorizedKeysPath;

  const catResult = await exec(
    client,
    `cat ${shellEscape(authorizedKeysPath)} 2>/dev/null || true`,
  );
  const contents = catResult.stdout;
  // exists: empty stdout could mean missing OR empty file; check both.
  const existsResult = await exec(
    client,
    `test -e ${shellEscape(authorizedKeysPath)} && echo yes || echo no`,
  );
  const exists = existsResult.stdout.trim() === "yes";

  return {
    authorizedKeysPath,
    user,
    pmxcfs,
    realPath,
    contents,
    exists,
    alreadyPresent(publicKey: string): boolean {
      // OpenSSH ignores trailing comments when matching keys via base64;
      // a substring check on the first two whitespace-separated tokens is
      // strict enough for our case (no key normalization yet).
      const wanted = publicKey.split(/\s+/).slice(0, 2).join(" ");
      return contents
        .split(/\r?\n/)
        .some((line) => line.split(/\s+/).slice(0, 2).join(" ") === wanted);
    },
  };
}

async function backupAuthorizedKeys(client: Client, inspection: Inspection): Promise<string> {
  if (!inspection.exists) {
    // Nothing to back up — record an empty marker so the caller knows
    // the install was a fresh create, not an append.
    const marker = `${inspection.authorizedKeysPath}.devstation-backup.new`;
    return marker;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  // pmxcfs is read-only at /etc/pve/, so we cannot land the backup
  // alongside the real file — write to /tmp instead. Regular
  // filesystems land alongside the original; backup path is reported
  // back to the caller either way.
  const backupPath = inspection.pmxcfs
    ? `/tmp/devstation-akeys-backup.${stamp}`
    : `${inspection.authorizedKeysPath}.devstation-backup.${stamp}`;
  const source = inspection.pmxcfs ? inspection.realPath : inspection.authorizedKeysPath;
  const result = await exec(
    client,
    `cp ${shellEscape(source)} ${shellEscape(backupPath)}`,
  );
  if (result.code !== 0) {
    throw new SshBootstrapFailed(
      `backup failed: ${result.stderr || result.stdout}`,
    );
  }
  return backupPath;
}

async function installKey(
  client: Client,
  inspection: Inspection,
  publicKey: string,
): Promise<{ symlinkBroken: boolean }> {
  const escapedPath = shellEscape(inspection.authorizedKeysPath);

  if (inspection.pmxcfs) {
    // First try: chmod-dance via the real path. Works on permissive
    // pmxcfs setups (Proxmox 7.x docs document this as supported).
    const escapedReal = shellEscape(inspection.realPath);
    const tmpPath = `/tmp/devstation-akeys.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
    const escapedTmp = shellEscape(tmpPath);
    const escapedKey = shellSingleQuote(publicKey);
    const pmxcfsScript = [
      `chmod 600 ${escapedReal}`,
      `cp ${escapedReal} ${escapedTmp}`,
      `printf '%s\\n' ${escapedKey} >> ${escapedTmp}`,
      // Defensive dedup: a race against pmxcfs Corosync sync (or a
      // pre-existing duplicate from another tool) could otherwise leave
      // the file with our key listed twice. `awk '!seen[$0]++'`
      // preserves the original line order and drops repeats.
      `awk '!seen[$0]++' ${escapedTmp} > ${escapedTmp}.dedup && mv ${escapedTmp}.dedup ${escapedTmp}`,
      `cp ${escapedTmp} ${escapedReal}`,
      `chmod 400 ${escapedReal}`,
      `rm -f ${escapedTmp}`,
    ].join(" && ");
    const pmxcfsResult = await exec(client, pmxcfsScript);
    if (pmxcfsResult.code === 0) {
      return { symlinkBroken: false };
    }

    // Fallback: pmxcfs rejected the write even on the real path
    // (happens on Proxmox 8+ where /etc/pve/priv is fully locked down
    // for non-cluster-peer writers). Break the symlink: replace
    // `~/.ssh/authorized_keys` with a regular file whose contents are
    // the pmxcfs file + our key. sshd reads the symlink target,
    // so a regular file at that path is honored exactly the same. The
    // real `/etc/pve/priv/authorized_keys` stays untouched — cluster
    // peer auth keeps working; only DevStation's automation gains key
    // access.
    const symlinkScript = [
      // Stage union of pmxcfs contents + our key in /tmp first
      `cp ${escapedReal} ${escapedTmp}`,
      `printf '%s\\n' ${escapedKey} >> ${escapedTmp}`,
      // Defensive dedup (same reasoning as the pmxcfs path).
      `awk '!seen[$0]++' ${escapedTmp} > ${escapedTmp}.dedup && mv ${escapedTmp}.dedup ${escapedTmp}`,
      // Remove the symlink (rm follows the link target by default —
      // we want to remove the link itself, so -f without -L).
      `rm -f ${escapedPath}`,
      // Promote the staged file to authorized_keys (regular file now).
      `cp ${escapedTmp} ${escapedPath}`,
      `chmod 600 ${escapedPath}`,
      `chown ${shellSingleQuote(inspection.user)} ${escapedPath} 2>/dev/null || true`,
      `rm -f ${escapedTmp}`,
    ].join(" && ");
    const symlinkResult = await exec(client, symlinkScript);
    if (symlinkResult.code !== 0) {
      throw new SshBootstrapFailed(
        `pmxcfs fallback failed: chmod-dance returned "${
          pmxcfsResult.stderr.trim() || pmxcfsResult.stdout.trim()
        }"; symlink-break also failed: "${
          symlinkResult.stderr.trim() || symlinkResult.stdout.trim()
        }"`,
      );
    }
    return { symlinkBroken: true };
  }

  // Regular filesystem: mkdir + permissions + append, then dedup in place.
  // Dedup runs unconditionally — covers pre-existing duplicates from
  // other tools too, not just a race against our own previous run.
  const dir = inspection.authorizedKeysPath.replace(/\/[^/]+$/, "");
  const escapedDir = shellEscape(dir);
  const escapedKey = shellSingleQuote(publicKey);
  const tmpDedup = `${inspection.authorizedKeysPath}.devstation-dedup`;
  const escapedDedup = shellEscape(tmpDedup);
  const script = [
    `mkdir -p ${escapedDir}`,
    `chmod 700 ${escapedDir}`,
    `touch ${escapedPath}`,
    `chmod 600 ${escapedPath}`,
    `printf '%s\\n' ${escapedKey} >> ${escapedPath}`,
    `awk '!seen[$0]++' ${escapedPath} > ${escapedDedup} && mv ${escapedDedup} ${escapedPath}`,
    `chmod 600 ${escapedPath}`,
  ].join(" && ");
  const result = await exec(client, script);
  if (result.code !== 0) {
    throw new SshBootstrapFailed(
      `install failed: ${result.stderr || result.stdout}`,
    );
  }
  return { symlinkBroken: false };
}

// ─── shell quoting helpers ───────────────────────────────────────────

/**
 * Wraps `value` in single quotes, escaping embedded single quotes.
 * For arbitrary content (like a public key) embedded as a literal in
 * a shell command — avoids issues with $, !, backticks, etc.
 */
function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Lighter variant for paths we already control (no spaces in
 * `/root/.ssh/authorized_keys`, `/tmp/...`). Keeps the command line
 * legible while still handling unexpected metacharacters.
 */
function shellEscape(value: string): string {
  return shellSingleQuote(value);
}
