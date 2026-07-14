import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { ImageUsages } from "@server/images/domain/ports/outbound/image-usages.ts";
import type { ImageRecord } from "@server/images/application/queries/all/types/image-record.ts";
import type { ImageUsageRecord } from "@server/images/application/queries/all/types/image-usage-record.ts";

const FILE = "images.json";

type RawImage = { id: string; name: string; os: string; sourceUrl: string; version: number };

/**
 * Lists the catalog, each row carrying where it is in use (cluster/node
 * templates) so the UI can show a usage count and warn before a delete.
 */
export class Query {
  constructor(
    private readonly fs: FileSystem,
    private readonly usages: ImageUsages,
  ) {}

  async execute(): Promise<ImageRecord[]> {
    const [images, usages] = await Promise.all([
      this.fs.readObjectsOf<RawImage>(FILE),
      this.usages.all(),
    ]);

    const byImage = new Map<string, ImageUsageRecord[]>();
    for (const u of usages) {
      const list = byImage.get(u.imageId.value) ?? [];
      list.push({
        clusterId: u.clusterId,
        clusterName: u.clusterName,
        nodeId: u.nodeId,
        nodeName: u.nodeName,
      });
      byImage.set(u.imageId.value, list);
    }

    return images.map((i) => ({ ...i, usages: byImage.get(i.id) ?? [] }));
  }
}
