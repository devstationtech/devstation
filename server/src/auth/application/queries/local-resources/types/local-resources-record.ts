// Snapshot of the local machine running the CLI. Values are 0..100; the CLI
// renders them in the title-box footer so the operator sees host pressure
// while interacting with remote provisioning.
export type LocalResourcesRecord = {
  cpuPercent: number;
  ramPercent: number;
};
