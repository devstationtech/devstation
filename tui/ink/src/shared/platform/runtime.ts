/**
 * Runtime facade — the single seam that isolates the UI from the host
 * runtime (`Deno.*`). Mirrors the server's hexagonal approach: code
 * depends on these interfaces, never on `Deno.*` directly, so swapping
 * to Bun/Node later means writing one new adapter, not editing every
 * call site.
 *
 * The concrete `Deno` implementation lives in `deno-runtime.ts` — the
 * ONLY file in `tui/ink/` that touches `Deno.*`. Consumers take a
 * `Runtime` (or a sub-port) via a default parameter so production wires
 * `denoRuntime` automatically while tests inject a fake.
 *
 * Grouped into cohesive ports rather than one god-interface:
 *   - FileSystem: file/dir I/O
 *   - Process:    subprocess execution
 *   - Terminal:   stdin/stdout TTY interaction
 *   - Env:        environment + platform identity
 */

export interface FileSystem {
  readTextFile(path: string): Promise<string>;
  /** Accepts a path or a `file:`/embedded-asset URL (deno-compile assets). */
  readFile(path: string | URL): Promise<Uint8Array>;
  writeTextFile(path: string, data: string): Promise<void>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean; mode?: number }): Promise<void>;
  stat(path: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number }>;
  rename(from: string, to: string): Promise<void>;
  copyFile(from: string, to: string): Promise<void>;
  chmod(path: string, mode: number): Promise<void>;
  remove(path: string, options?: { recursive?: boolean }): Promise<void>;
  /** Opens a file for writing, returning its writable stream (for piping). */
  createWritable(path: string): Promise<WritableStream<Uint8Array>>;
  /** True when the error is a not-found error, runtime-agnostic. */
  isNotFound(error: unknown): boolean;
  /** True when the error is a permission-denied error. */
  isPermissionDenied(error: unknown): boolean;
  /** True when a rename failed across filesystems (EXDEV / NotSupported). */
  isCrossDevice(error: unknown): boolean;
  /** Synchronous directory listing (entry name + kind). */
  readDirSync(path: string): DirEntry[];
  /** True when `path` exists (synchronous), runtime-agnostic. */
  existsSync(path: string): boolean;
}

export type DirEntry = { name: string; isFile: boolean; isDirectory: boolean };

export type SpawnResult = {
  success: boolean;
  code: number;
  stderr: Uint8Array;
};

export type Signal = "SIGINT" | "SIGTERM" | "SIGHUP" | "SIGBREAK";

/** A long-lived child wired for bidirectional streaming (JSON-RPC stdio). */
export type ChannelProcess = {
  readonly stdin: WritableStream<Uint8Array>;
  readonly stdout: ReadableStream<Uint8Array>;
  readonly status: Promise<unknown>;
  kill(): void;
};

export interface Process {
  /** Run a command to completion (stdout discarded, stderr captured). */
  run(command: string, args: string[]): Promise<SpawnResult>;
  /** Spawn a long-lived child with piped stdio for channel transports. */
  spawnChannel(command: string, args: readonly string[]): ChannelProcess;
  /** Spawn a command inheriting this process's stdio; resolves its exit code. */
  spawnInherit(command: string, args: string[]): Promise<number>;
  /** Terminate the current process with the given exit code. */
  exit(code: number): never;
  /** Subscribe to an OS signal (no-op-safe for signals the host rejects). */
  onSignal(signal: Signal, handler: () => void): void;
  /** Unsubscribe a previously-registered signal handler. */
  offSignal(signal: Signal, handler: () => void): void;
}

export interface Terminal {
  stdinIsTerminal(): boolean;
  stdoutIsTerminal(): boolean;
  setRawStdin(raw: boolean): void;
  /** Reads up to `buf.length` bytes into `buf`; resolves byte count or null on EOF. */
  readStdin(buf: Uint8Array): Promise<number | null>;
  writeStdout(data: Uint8Array): Promise<number>;
  /** Synchronous stderr write — used for boot-time diagnostics. */
  writeStderrSync(data: Uint8Array): void;
  /** Synchronous stdout write — used for terminal escape sequences. */
  writeStdoutSync(data: Uint8Array): void;
  /** Terminal width in columns; falls back to 80 when not a TTY. */
  columns(): number;
}

export type OsKind =
  | "darwin"
  | "linux"
  | "windows"
  | "freebsd"
  | "netbsd"
  | "aix"
  | "solaris"
  | "illumos"
  | "android";
export type ArchKind = "x86_64" | "aarch64";

export interface Env {
  get(name: string): string | undefined;
  set(name: string, value: string): void;
  execPath(): string;
  /** The host machine's network name. */
  hostname(): string;
  readonly os: OsKind;
  readonly arch: ArchKind;
  readonly pid: number;
}

export interface Runtime {
  readonly fs: FileSystem;
  readonly process: Process;
  readonly terminal: Terminal;
  readonly env: Env;
}
