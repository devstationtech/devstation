/**
 * The ONLY file in `tui/ink/` that touches `Deno.*`.
 *
 * Implements the runtime ports from `runtime.ts` against the Deno
 * host. A future Bun/Node port is a sibling file implementing the same
 * interfaces — no consumer changes.
 */
import type {
  ArchKind,
  Env,
  FileSystem,
  OsKind,
  Process,
  Runtime,
  SpawnResult,
  Terminal,
} from "@ui/shared/platform/runtime.ts";

/**
 * DevStation home for the engine-stderr log drain. Honors `DEVSTATION_HOME`,
 * else defaults per build: `devstation` (prod) / `devstation-dev` (dev),
 * matching `@ui/cli/paths.ts`. Kept local — this file is the sole `Deno.*`
 * seam and must not import the runtime facade it implements.
 */
function devstationHome(): string {
  const sep = Deno.build.os === "windows" ? "\\" : "/";
  const override = Deno.env.get("DEVSTATION_HOME");
  if (override) return override;
  const base = Deno.execPath().split(/[\\/]/).pop()?.toLowerCase() ?? "";
  const name = base.startsWith("deno") ? "devstation-dev" : "devstation";
  if (Deno.build.os === "windows") {
    const appData = Deno.env.get("APPDATA");
    if (appData) return `${appData}${sep}${name}`;
  }
  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? ".";
  return `${home}${sep}${name}`;
}

/**
 * Best-effort drain of a spawned engine's stderr into
 * `<home>/logs/engine.stderr.log`, so its startup TLS warning and any
 * diagnostics are captured off the terminal. Never throws — a logging
 * failure must not affect the running app.
 */
async function drainEngineStderr(stream: ReadableStream<Uint8Array>): Promise<void> {
  const sep = Deno.build.os === "windows" ? "\\" : "/";
  const dir = `${devstationHome()}${sep}logs`;
  try {
    await Deno.mkdir(dir, { recursive: true });
    const file = await Deno.open(`${dir}${sep}engine.stderr.log`, {
      append: true,
      create: true,
      write: true,
    });
    await stream.pipeTo(file.writable);
  } catch {
    // Logging is best-effort; if it fails, drain to nowhere so the engine's
    // stderr pipe never fills and blocks the child.
    try {
      await stream.cancel();
    } catch { /* already closed */ }
  }
}

const fs: FileSystem = {
  readTextFile: (path) => Deno.readTextFile(path),
  readFile: (path) => Deno.readFile(path),
  // deno-runtime: Deno.readFile accepts string | URL natively.
  writeTextFile: (path, data) => Deno.writeTextFile(path, data),
  writeFile: (path, data) => Deno.writeFile(path, data),
  mkdir: (path, options) => Deno.mkdir(path, options),
  stat: async (path) => {
    const s = await Deno.stat(path);
    return { isFile: s.isFile, isDirectory: s.isDirectory, size: s.size };
  },
  rename: (from, to) => Deno.rename(from, to),
  copyFile: (from, to) => Deno.copyFile(from, to),
  chmod: (path, mode) => Deno.chmod(path, mode),
  remove: (path, options) => Deno.remove(path, options),
  createWritable: async (path) => (await Deno.create(path)).writable,
  isNotFound: (error) => error instanceof Deno.errors.NotFound,
  isPermissionDenied: (error) => error instanceof Deno.errors.PermissionDenied,
  isCrossDevice: (error) =>
    error instanceof Deno.errors.NotSupported ||
    (error instanceof Error && /cross-device|EXDEV/i.test(error.message)),
  readDirSync: (path) =>
    Array.from(Deno.readDirSync(path), (e) => ({
      name: e.name,
      isFile: e.isFile,
      isDirectory: e.isDirectory,
    })),
  existsSync: (path) => {
    try {
      Deno.statSync(path);
      return true;
    } catch {
      return false;
    }
  },
};

const process: Process = {
  run: async (command, args): Promise<SpawnResult> => {
    const out = await new Deno.Command(command, {
      args,
      stdout: "null",
      stderr: "piped",
    }).output();
    return { success: out.success, code: out.code, stderr: out.stderr };
  },
  spawnChannel: (command, args) => {
    const child = new Deno.Command(command, {
      args: [...args],
      stdin: "piped",
      stdout: "piped",
      // Capture the engine's stderr to a log file instead of inheriting it.
      // The engine runs with `--unsafely-ignore-certificate-errors` (homelab
      // Proxmox boxes are self-signed; Deno only honors that toggle as a CLI
      // flag, not per-request), which makes Deno print a "TLS validation
      // disabled" warning at startup. Inheriting would leak that warning — and
      // any engine stderr — onto the user's terminal and corrupt the Ink TUI.
      // Draining it to `<home>/logs/engine.stderr.log` keeps diagnostics
      // without the noise. The UI process itself never disables TLS.
      stderr: "piped",
    }).spawn();
    void drainEngineStderr(child.stderr);
    return {
      stdin: child.stdin,
      stdout: child.stdout,
      status: child.status,
      kill: () => {
        try {
          child.kill("SIGTERM");
        } catch {
          // already exited
        }
      },
    };
  },
  spawnInherit: async (command, args): Promise<number> => {
    const child = new Deno.Command(command, {
      args,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    }).spawn();
    const status = await child.status;
    return status.code;
  },
  exit: (code) => Deno.exit(code),
  onSignal: (signal, handler) => Deno.addSignalListener(signal, handler),
  offSignal: (signal, handler) => Deno.removeSignalListener(signal, handler),
};

const terminal: Terminal = {
  stdinIsTerminal: () => {
    try {
      return Deno.stdin.isTerminal();
    } catch {
      return false;
    }
  },
  stdoutIsTerminal: () => {
    try {
      return Deno.stdout.isTerminal();
    } catch {
      return false;
    }
  },
  setRawStdin: (raw) => Deno.stdin.setRaw(raw),
  readStdin: (buf) => Deno.stdin.read(buf),
  writeStdout: (data) => Deno.stdout.write(data),
  writeStderrSync: (data) => {
    Deno.stderr.writeSync(data);
  },
  writeStdoutSync: (data) => {
    Deno.stdout.writeSync(data);
  },
  columns: () => {
    try {
      return Deno.consoleSize().columns;
    } catch {
      return 80;
    }
  },
};

const env: Env = {
  get: (name) => Deno.env.get(name),
  set: (name, value) => Deno.env.set(name, value),
  execPath: () => Deno.execPath(),
  hostname: () => Deno.hostname(),
  os: Deno.build.os as OsKind,
  arch: Deno.build.arch as ArchKind,
  pid: Deno.pid,
};

export const denoRuntime: Runtime = { fs, process, terminal, env };
