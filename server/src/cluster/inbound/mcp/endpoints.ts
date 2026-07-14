/**
 * Cluster BC — MCP endpoint catalog.
 *
 * Each entry is the MCP-port counterpart of an RPC endpoint in
 * `cluster/inbound/rpc/`. They consume the **same handlers/queries**
 * as the RPC adapters, but call them directly (no JSON-RPC envelope).
 *
 * Composition root (`src/mcp.ts`) instantiates each via the DI
 * container and registers them in `EndpointRegistry`.
 */
export { ListClustersMcpEndpoint } from "@server/cluster/inbound/mcp/list/endpoint.ts";
export { ClusterByIdMcpEndpoint } from "@server/cluster/inbound/mcp/by-id/endpoint.ts";
export { ListProxmoxNodesMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/nodes/list/endpoint.ts";
export { ListProxmoxVirtualMachinesMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/virtual-machine/list/endpoint.ts";
export { ListVirtualMachineTagsMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/virtual-machine/tags/endpoint.ts";
export { ListProxmoxConnectionsMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/connections/list/endpoint.ts";
export { ListImagesMcpEndpoint } from "@server/cluster/inbound/mcp/images/list/endpoint.ts";
export { ProvisionPreviewMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/provision/endpoint.ts";
export { PlanNodesMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/provisioning/plan/endpoint.ts";
export { ApplyNodesMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/provisioning/apply/endpoint.ts";
export { DestroyNodesMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/provisioning/destroy/endpoint.ts";
export { CreateImageMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/images/create/endpoint.ts";
export { AcknowledgeInterruptionMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/nodes/acknowledge-interruption/endpoint.ts";
export { RegisterNodeMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/nodes/register/endpoint.ts";
export { RegisterVirtualMachineMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/virtual-machine/register/endpoint.ts";
// Cluster lifecycle + node/image writes
export { RegisterClusterMcpEndpoint } from "@server/cluster/inbound/mcp/register/endpoint.ts";
export { UnregisterClusterMcpEndpoint } from "@server/cluster/inbound/mcp/unregister/endpoint.ts";
export { ConnectClusterMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/connect/endpoint.ts";
export { DisconnectClusterMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/disconnect/endpoint.ts";
export { UpdateNodeMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/nodes/update/endpoint.ts";
export { UnregisterNodeMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/nodes/unregister/endpoint.ts";
export { UnregisterAllNodesMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/nodes/unregister-all/endpoint.ts";
// Cluster VM writes + image assignment + misc reads
export { UpdateVirtualMachineMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/virtual-machine/update/endpoint.ts";
export { UnregisterVirtualMachineMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/virtual-machine/unregister/endpoint.ts";
export { UnregisterAllVirtualMachinesMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/virtual-machine/unregister-all/endpoint.ts";
export { VirtualMachineByImageMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/virtual-machine/by-image/endpoint.ts";
export { VirtualMachineMetricsMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/virtual-machine/metrics/endpoint.ts";
export { AssignImageMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/images/assign/endpoint.ts";
export { UnassignImageMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/images/unassign/endpoint.ts";
export { UpdateAssignedImageMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/images/update-assigned/endpoint.ts";
export { StorageByNodeMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/storage/by-node/endpoint.ts";
export { TestProxmoxConnectionMcpEndpoint } from "@server/cluster/inbound/mcp/proxmox/test-connection/endpoint.ts";
// Connection bootstrap — one-shot password SSH to install the automation key
export { BootstrapKeyMcpEndpoint } from "@server/cluster/inbound/mcp/connection/bootstrap-key/endpoint.ts";
// Capability listings
export { ListProvidersMcpEndpoint } from "@server/cluster/inbound/mcp/providers/list/endpoint.ts";
export { ListOperatingSystemsMcpEndpoint } from "@server/cluster/inbound/mcp/operating-systems/list/endpoint.ts";
// Resources
export { ClustersResource } from "@server/cluster/inbound/mcp/resources/clusters.ts";
