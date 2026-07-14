import type { ProxmoxStorageRecord } from "@server/cluster/application/queries/proxmox/records/storage-record.ts";

export type StoragesByNodeRecord = {
  connected: boolean;
  storages: ProxmoxStorageRecord[];
};
