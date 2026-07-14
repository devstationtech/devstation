import { copy, emptyDir, ensureDir } from "@std/fs";
import { basename, join, resolve } from "@std/path";

const decoder = new TextDecoder();

export class DenoReleaseAdapter {
  readonly args = Deno.args;

  env(name: string) {
    return Deno.env.get(name);
  }

  nowIso() {
    return new Date().toISOString();
  }

  join(...paths: string[]) {
    return join(...paths);
  }

  resolve(...paths: string[]) {
    return resolve(...paths);
  }

  basename(path: string) {
    return basename(path);
  }

  async readTextFile(path: string) {
    return await Deno.readTextFile(path);
  }

  async writeTextFile(path: string, content: string) {
    await Deno.writeTextFile(path, content);
  }

  async appendTextFile(path: string, content: string) {
    await Deno.writeTextFile(path, content, { append: true });
  }

  async readJson<T>(path: string) {
    return JSON.parse(await this.readTextFile(path)) as T;
  }

  async readFile(path: string) {
    return await Deno.readFile(path);
  }

  async readDirFiles(path: string) {
    const entries = await Array.fromAsync(Deno.readDir(path));
    return entries
      .filter((entry) => entry.isFile)
      .map((entry) => join(path, entry.name))
      .sort();
  }

  async emptyDir(path: string) {
    await emptyDir(path);
  }

  async ensureDir(path: string) {
    await ensureDir(path);
  }

  async copyDir(from: string, to: string) {
    await copy(from, to, { overwrite: true });
  }

  async copyFile(from: string, to: string) {
    await Deno.copyFile(from, to);
  }

  async chmod(path: string, mode: number) {
    await Deno.chmod(path, mode);
  }

  async isDirectory(path: string) {
    try {
      return (await Deno.stat(path)).isDirectory;
    } catch {
      return false;
    }
  }

  async sha256Hex(data: Uint8Array) {
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async commandOutput(command: string, args: string[]) {
    try {
      const output = await new Deno.Command(command, { args }).output();
      if (!output.success) return undefined;
      return decoder.decode(output.stdout).trim() || undefined;
    } catch {
      return undefined;
    }
  }

  async run(command: string, args: string[]) {
    const child = new Deno.Command(command, {
      args,
      stdout: "inherit",
      stderr: "inherit",
    }).spawn();
    const status = await child.status;
    if (!status.success) {
      throw new Error(`${command} ${args.join(" ")} failed with code ${status.code}`);
    }
  }

  /** Variant of `run` that pins the cwd — used by zip which insists on
   * archiving the current directory and we want the entries to be the
   * package contents (not the parent path). */
  async runIn(cwd: string, command: string, args: string[]) {
    const child = new Deno.Command(command, {
      args,
      cwd,
      stdout: "inherit",
      stderr: "inherit",
    }).spawn();
    const status = await child.status;
    if (!status.success) {
      throw new Error(`${command} ${args.join(" ")} in ${cwd} failed with code ${status.code}`);
    }
  }
}
