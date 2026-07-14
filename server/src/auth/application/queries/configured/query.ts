import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";

const SALT_FILE = ".salt";

export class Query {
  constructor(private readonly fs: FileSystem) {}

  execute(): Promise<boolean> {
    return this.fs.exists(SALT_FILE);
  }
}
