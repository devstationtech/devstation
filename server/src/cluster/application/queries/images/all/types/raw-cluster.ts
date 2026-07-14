import type { RawNode } from "@server/cluster/application/queries/images/all/types/raw-node.ts";

export type RawCluster = {
  id: string;
  name: string;
  nodes: RawNode[];
};
