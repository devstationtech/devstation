import type { ImageUsageRecord } from "@server/images/application/queries/all/types/image-usage-record.ts";

export type ImageRecord = {
  id: string;
  name: string;
  os: string;
  sourceUrl: string;
  version: number;
  /** Where this catalog image is currently assigned (cluster/node templates). */
  usages: ImageUsageRecord[];
};
