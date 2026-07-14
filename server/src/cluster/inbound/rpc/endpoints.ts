/**
 * Cluster BC — RPC endpoint catalog.
 *
 * Every method is protected. Long-running endpoints (provisioning plan/apply/
 * destroy, images.create) follow the LSP-style streaming pattern: request
 * stays pending, progress flows via `operation.event` notifications,
 * response carries the typed result.
 */
export { RegisterClusterEndpoint } from "@server/cluster/inbound/rpc/register/endpoint.ts";
export { SubscribeClusterEndpoint } from "@server/cluster/inbound/rpc/subscribe/endpoint.ts";
export { UnregisterClusterEndpoint } from "@server/cluster/inbound/rpc/unregister/endpoint.ts";
export { ConnectClusterEndpoint } from "@server/cluster/inbound/rpc/proxmox/connect/endpoint.ts";
export { DisconnectClusterEndpoint } from "@server/cluster/inbound/rpc/proxmox/disconnect/endpoint.ts";
export { RegisterNodeEndpoint } from "@server/cluster/inbound/rpc/proxmox/nodes/register/endpoint.ts";
export { UpdateNodeEndpoint } from "@server/cluster/inbound/rpc/proxmox/nodes/update/endpoint.ts";
export { UnregisterNodeEndpoint } from "@server/cluster/inbound/rpc/proxmox/nodes/unregister/endpoint.ts";
export { UnregisterAllNodesEndpoint } from "@server/cluster/inbound/rpc/proxmox/nodes/unregister-all/endpoint.ts";
export { AcknowledgeInterruptionEndpoint } from "@server/cluster/inbound/rpc/proxmox/nodes/acknowledge-interruption/endpoint.ts";
export { AssignImageEndpoint } from "@server/cluster/inbound/rpc/proxmox/images/assign/endpoint.ts";
export { UnassignImageEndpoint } from "@server/cluster/inbound/rpc/proxmox/images/unassign/endpoint.ts";
export { UpdateAssignedImageEndpoint } from "@server/cluster/inbound/rpc/proxmox/images/update-assigned/endpoint.ts";
export { RegisterVirtualMachineEndpoint } from "@server/cluster/inbound/rpc/proxmox/virtual-machine/register/endpoint.ts";
export { UpdateVirtualMachineEndpoint } from "@server/cluster/inbound/rpc/proxmox/virtual-machine/update/endpoint.ts";
export { UnregisterVirtualMachineEndpoint } from "@server/cluster/inbound/rpc/proxmox/virtual-machine/unregister/endpoint.ts";
export { UnregisterAllVirtualMachinesEndpoint } from "@server/cluster/inbound/rpc/proxmox/virtual-machine/unregister-all/endpoint.ts";
export { ListClustersEndpoint } from "@server/cluster/inbound/rpc/list/endpoint.ts";
export { ClusterByIdEndpoint } from "@server/cluster/inbound/rpc/by-id/endpoint.ts";
export { ListImagesEndpoint } from "@server/cluster/inbound/rpc/images/list/endpoint.ts";
export { ListProxmoxConnectionsEndpoint } from "@server/cluster/inbound/rpc/proxmox/connections/list/endpoint.ts";
export { ListProxmoxNodesEndpoint } from "@server/cluster/inbound/rpc/proxmox/nodes/list/endpoint.ts";
export { StorageByNodeEndpoint } from "@server/cluster/inbound/rpc/proxmox/storage/by-node/endpoint.ts";
export { ListProxmoxVirtualMachinesEndpoint } from "@server/cluster/inbound/rpc/proxmox/virtual-machine/list/endpoint.ts";
export { ListVirtualMachineTagsEndpoint } from "@server/cluster/inbound/rpc/proxmox/virtual-machine/tags/endpoint.ts";
export { TestProxmoxConnectionEndpoint } from "@server/cluster/inbound/rpc/proxmox/test-connection/endpoint.ts";
// Connection bootstrap — one-shot password SSH to install the automation key
export { BootstrapKeyEndpoint } from "@server/cluster/inbound/rpc/connection/bootstrap-key/endpoint.ts";
export { ProvisionEndpoint as ProxmoxProvisionEndpoint } from "@server/cluster/inbound/rpc/proxmox/provision/endpoint.ts";
export { VirtualMachineMetricsEndpoint as ProxmoxVirtualMachineMetricsEndpoint } from "@server/cluster/inbound/rpc/proxmox/virtual-machine/metrics/endpoint.ts";
export { VirtualMachineByImageEndpoint as ProxmoxVirtualMachineByImageEndpoint } from "@server/cluster/inbound/rpc/proxmox/virtual-machine/by-image/endpoint.ts";
export { PlanEndpoint as ProxmoxProvisioningPlanEndpoint } from "@server/cluster/inbound/rpc/proxmox/provisioning/plan/endpoint.ts";
export { ApplyEndpoint as ProxmoxProvisioningApplyEndpoint } from "@server/cluster/inbound/rpc/proxmox/provisioning/apply/endpoint.ts";
export { DestroyEndpoint as ProxmoxProvisioningDestroyEndpoint } from "@server/cluster/inbound/rpc/proxmox/provisioning/destroy/endpoint.ts";
export { CreateImageEndpoint as ProxmoxImagesCreateEndpoint } from "@server/cluster/inbound/rpc/proxmox/images/create/endpoint.ts";
// Capability listings — UI/agent consume these via wire, never hardcode.
export { ListProvidersEndpoint } from "@server/cluster/inbound/rpc/providers/list/endpoint.ts";
export { ListOperatingSystemsEndpoint } from "@server/cluster/inbound/rpc/operating-systems/list/endpoint.ts";
