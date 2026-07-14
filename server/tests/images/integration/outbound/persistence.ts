import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

export type ImageRecord = {
  id: string;
  name: string;
  os: string;
  sourceUrl: string;
  version: number;
  creation: { by: string; hostname: string; at: string };
};

export class Persistence {
  constructor(readonly dir: string = Deno.makeTempDirSync()) {}

  teardown(): Promise<void> {
    return Deno.remove(this.dir, { recursive: true });
  }

  async readImages(): Promise<ImageRecord[]> {
    const raw = await readFile(join(this.dir, "images.json"), "utf-8");
    return JSON.parse(raw);
  }

  writeImages(records: ImageRecord[]): Promise<void> {
    return writeFile(
      join(this.dir, "images.json"),
      JSON.stringify(records, null, 2) + "\n",
      "utf-8",
    );
  }
}
