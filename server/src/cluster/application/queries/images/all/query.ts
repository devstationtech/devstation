import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { RawCluster } from "@server/cluster/application/queries/images/all/types/raw-cluster.ts";
import type { ImageRecord } from "@server/cluster/application/queries/images/all/types/image-record.ts";

const CLUSTERS_FILE = "clusters.json";

/**
 * Lists the image *assignments* across clusters — one record per
 * (node, image) pair, carrying the snapshot taken at assign time. The central
 * catalog is owned by the `images` context (`image.list`); this query only
 * reports where images have been materialized as node templates.
 */
export class Query {
  constructor(private readonly fs: FileSystem) {}

  async execute(clusterId?: string): Promise<ImageRecord[]> {
    const clusters = await this.fs.readObjectsOf<RawCluster>(CLUSTERS_FILE);
    const records: ImageRecord[] = [];

    for (const cluster of clusters) {
      if (clusterId && cluster.id !== clusterId) continue;

      for (const node of cluster.nodes) {
        for (const nt of node.images) {
          records.push({
            imageId: nt.imageId,
            name: nt.name ?? nt.imageId,
            os: nt.os ?? "",
            sourceUrl: nt.sourceUrl ?? "",
            clusterId: cluster.id,
            clusterName: cluster.name,
            nodeId: node.id,
            nodeName: node.name,
            virtualMachineId: nt.virtualMachineId,
            storage: nt.storage,
          });
        }
      }
    }

    return records;
  }
}
