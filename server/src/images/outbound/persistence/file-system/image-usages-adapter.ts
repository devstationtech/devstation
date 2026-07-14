import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { ImageUsages } from "@server/images/domain/ports/outbound/image-usages.ts";
import { ImageUsage } from "@server/images/domain/models/usage/image-usage.ts";
import { Id } from "@server/images/domain/models/id.ts";

const FILENAME = "image-usage.json";

type Record_ = {
  imageId: string;
  clusterId: string;
  clusterName: string;
  nodeId: string;
  nodeName: string;
};

/**
 * File-system projection of image usage over `image-usage.json`. A flat list of
 * (image, cluster, node) slots; `record` upserts and `forget` removes, keyed by
 * the (imageId, clusterId, nodeId) triple.
 */
export class Adapter implements ImageUsages {
  constructor(private readonly fs: FileSystem) {}

  async record(usage: ImageUsage): Promise<void> {
    const rows = await this.readAll();
    const kept = rows.filter((u) => !u.sameSlot(usage.imageId, usage.clusterId, usage.nodeId));
    await this.writeAll([...kept, usage]);
  }

  async forget(imageId: Id, clusterId: string, nodeId: string): Promise<void> {
    const rows = await this.readAll();
    const kept = rows.filter((u) => !u.sameSlot(imageId, clusterId, nodeId));
    if (kept.length !== rows.length) await this.writeAll(kept);
  }

  async of(imageId: Id): Promise<ImageUsage[]> {
    const rows = await this.readAll();
    return rows.filter((u) => u.imageId.value === imageId.value);
  }

  all(): Promise<ImageUsage[]> {
    return this.readAll();
  }

  private async readAll(): Promise<ImageUsage[]> {
    const records = await this.fs.readObjectsOf<Record_>(FILENAME);
    return records.map((r) =>
      new ImageUsage(new Id(r.imageId), r.clusterId, r.clusterName, r.nodeId, r.nodeName)
    );
  }

  private writeAll(usages: ImageUsage[]): Promise<void> {
    return this.fs.writeObjectsOf<Record_>(
      FILENAME,
      usages.map((u) => ({
        imageId: u.imageId.value,
        clusterId: u.clusterId,
        clusterName: u.clusterName,
        nodeId: u.nodeId,
        nodeName: u.nodeName,
      })),
    );
  }
}
