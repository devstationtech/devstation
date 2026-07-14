export class ClusterNotFound extends Error {
  constructor(clusterId: string) {
    super(`cluster '${clusterId}' not found.`);
  }
}
