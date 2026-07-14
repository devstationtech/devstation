import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

export type SizeRecord = {
  id: string;
  name: string;
  provider: string;
  version: number;
  cpu: number;
  ram: number;
  disk: number;
  creation: { by: string; hostname: string; at: string };
};

export class Persistence {
  constructor(readonly dir: string = Deno.makeTempDirSync()) {}

  teardown(): Promise<void> {
    return Deno.remove(this.dir, { recursive: true });
  }

  async readSizes(): Promise<SizeRecord[]> {
    const raw = await readFile(join(this.dir, "sizes.json"), "utf-8");
    return JSON.parse(raw);
  }

  writeSizes(records: SizeRecord[]): Promise<void> {
    return writeFile(
      join(this.dir, "sizes.json"),
      JSON.stringify(records, null, 2) + "\n",
      "utf-8",
    );
  }
}
