import type { ProxmoxLiveResources } from "@server/cluster/application/queries/proxmox/records/live-resources.ts";
import type { ProxmoxLocalResources } from "@server/cluster/application/queries/proxmox/records/local-resources.ts";

export type ProxmoxResources = {
  connected: boolean;
  live?: ProxmoxLiveResources;
  local: ProxmoxLocalResources;
};
