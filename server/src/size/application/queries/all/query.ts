import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { SizeRecord } from "@server/size/application/queries/all/types/size-record.ts";

const FILE = "sizes.json";

export class Query {
  constructor(private readonly fs: FileSystem) {}

  async execute(): Promise<SizeRecord[]> {
    return await this.fs.readObjectsOf<SizeRecord>(FILE);
  }
}
