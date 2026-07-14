/**
 * Read model for `cluster.proxmox.connections.list` — connection plus
 * its resolved provisioning policy. Distinct from `connection-record.ts`
 * (the read-API factory input, which stays `{host,vaultId,secretId}`).
 */
export type ProxmoxConnectionListRecord = {
  host: string;
  vaultId: string;
  secretId: string;
  cloneStrategy: string;
  parallelism: number;
};
