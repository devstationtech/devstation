import type { ProxmoxConnectionRecord } from "@server/cluster/application/queries/proxmox/records/connection-record.ts";
import type { ProxmoxReadApi } from "@server/cluster/application/queries/proxmox/api/proxmox-read-api.ts";

export interface ProxmoxReadApiFactory {
  create(connection: ProxmoxConnectionRecord): Promise<ProxmoxReadApi | null>;
}
