/**
 * Runtime-agnostic subprocess contract for `SubprocessCall`. The lib never
 * touches a host runtime API directly — consumers inject a `Spawn` built on
 * whatever runtime they run (Deno, Node, Bun). `deno-spawn.ts` ships the
 * Deno implementation as an opt-in module, deliberately NOT exported from
 * `mod.ts` so the lib's public face stays portable.
 */
export type SpawnedProcess = {
  readonly stdin: WritableStream<Uint8Array>;
  readonly stdout: ReadableStream<Uint8Array>;
  /** Resolves when the child exits (any outcome). */
  readonly status: Promise<unknown>;
  /** Asks the child to terminate (SIGTERM-equivalent). */
  kill(): void;
};

export type Spawn = (command: string, args: readonly string[]) => SpawnedProcess;
