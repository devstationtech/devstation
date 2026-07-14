/**
 * One image materialized (or to-be-materialized) on a node: the point-in-time
 * catalog snapshot (name/os/sourceUrl) plus the operator-chosen template VMID
 * and storage. The central catalog itself lives in the `images` context; this
 * read model is purely the cluster's *assignments*.
 */
export type ImageRecord = {
  imageId: string;
  name: string;
  os: string;
  sourceUrl: string;
  clusterId: string;
  clusterName: string;
  nodeId: string;
  nodeName: string;
  virtualMachineId: number;
  storage: string;
};
