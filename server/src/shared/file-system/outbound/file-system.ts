import { dirname, join } from "node:path";

const OWNER_ONLY_DIR = 0o700;
const OWNER_ONLY_FILE = 0o600;

export class FileSystem {
  constructor(private readonly dir: string) {}

  subdir(name: string): FileSystem {
    return new FileSystem(join(this.dir, name));
  }

  /** Absolute path of `filename` within this filesystem's root. */
  resolve(filename: string): string {
    return join(this.dir, filename);
  }

  read(filename: string): Promise<string> {
    return Deno.readTextFile(join(this.dir, filename));
  }

  async readObjectOf<T>(filename: string): Promise<T | null> {
    try {
      const raw = await Deno.readTextFile(join(this.dir, filename));
      if (!raw.trim()) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return null;
      throw error;
    }
  }

  async readObjectsOf<T>(filename: string): Promise<T[]> {
    try {
      const raw = await Deno.readTextFile(join(this.dir, filename));
      if (!raw.trim()) return [];
      return JSON.parse(raw) as T[];
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return [];
      throw error;
    }
  }

  async write(filename: string, content: string): Promise<void> {
    const path = join(this.dir, filename);
    const dir = dirname(path);
    await Deno.mkdir(dir, { recursive: true, mode: OWNER_ONLY_DIR });
    await Deno.chmod(dir, OWNER_ONLY_DIR);
    await Deno.writeTextFile(path, content);
    await Deno.chmod(path, OWNER_ONLY_FILE);
  }

  writeObjectOf<T>(filename: string, data: T): Promise<void> {
    return this.write(filename, JSON.stringify(data, null, 2) + "\n");
  }

  writeObjectsOf<T>(filename: string, data: T[]): Promise<void> {
    return this.write(filename, JSON.stringify(data, null, 2) + "\n");
  }

  async append(filename: string, content: string): Promise<void> {
    const path = join(this.dir, filename);
    const dir = dirname(path);
    await Deno.mkdir(dir, { recursive: true, mode: OWNER_ONLY_DIR });
    await Deno.chmod(dir, OWNER_ONLY_DIR);
    await Deno.writeTextFile(path, content, { append: true });
    await Deno.chmod(path, OWNER_ONLY_FILE);
  }

  async exists(filename: string): Promise<boolean> {
    try {
      await Deno.stat(join(this.dir, filename));
      return true;
    } catch {
      return false;
    }
  }

  delete(filename: string): Promise<void> {
    return Deno.remove(join(this.dir, filename));
  }

  async list(): Promise<string[]> {
    const names: string[] = [];
    try {
      for await (const entry of Deno.readDir(this.dir)) {
        if (!entry.isFile) continue;
        names.push(entry.name);
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return [];
      throw error;
    }
    return names;
  }

  async listDirs(): Promise<string[]> {
    const names: string[] = [];
    try {
      for await (const entry of Deno.readDir(this.dir)) {
        if (!entry.isDirectory) continue;
        names.push(entry.name);
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return [];
      throw error;
    }
    return names;
  }
}
