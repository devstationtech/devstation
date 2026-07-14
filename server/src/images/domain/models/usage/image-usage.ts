import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import type { Id } from "@server/images/domain/models/id.ts";

/**
 * One place a catalog image is in use: the (cluster, node) it has been
 * assigned to as a template. The cluster + node ids/names are foreign
 * references kept as plain strings (anti-corruption) — the images context
 * never reaches into the cluster domain. Built from the cluster's
 * `ImageAssignedToNode` event and read back to warn before a catalog delete.
 */
export class ImageUsage implements ValueObject {
  constructor(
    readonly imageId: Id,
    readonly clusterId: string,
    readonly clusterName: string,
    readonly nodeId: string,
    readonly nodeName: string,
  ) {}

  /** Same template slot: same image on the same node of the same cluster. */
  sameSlot(imageId: Id, clusterId: string, nodeId: string): boolean {
    return this.imageId.value === imageId.value &&
      this.clusterId === clusterId &&
      this.nodeId === nodeId;
  }
}
