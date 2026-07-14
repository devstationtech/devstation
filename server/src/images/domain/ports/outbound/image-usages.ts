import type { Id } from "@server/images/domain/models/id.ts";
import type { ImageUsage } from "@server/images/domain/models/usage/image-usage.ts";

/**
 * Projection of where catalog images are in use, maintained from the cluster's
 * assign/unassign events. Idempotent: `record` upserts a (image, cluster, node)
 * slot, `forget` drops it.
 */
export interface ImageUsages {
  record(usage: ImageUsage): Promise<void>;
  forget(imageId: Id, clusterId: string, nodeId: string): Promise<void>;
  of(imageId: Id): Promise<ImageUsage[]>;
  all(): Promise<ImageUsage[]>;
}
