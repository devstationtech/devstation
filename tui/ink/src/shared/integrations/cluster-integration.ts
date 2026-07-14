import type {
  ClusterByIdRequest,
  ClusterByIdResponse,
  ClusterConnectionBootstrapKeyRequest,
  ClusterConnectionBootstrapKeyResponse,
  ClusterImagesListRequest,
  ClusterImagesListResponse,
  ClusterListRequest,
  ClusterListResponse,
  ClusterOperatingSystemsListRequest,
  ClusterOperatingSystemsListResponse,
  ClusterProvidersListRequest,
  ClusterProvidersListResponse,
  ClusterProxmoxConnectionsListRequest,
  ClusterProxmoxConnectionsListResponse,
  ClusterProxmoxConnectRequest,
  ClusterProxmoxConnectResponse,
  ClusterProxmoxDisconnectRequest,
  ClusterProxmoxDisconnectResponse,
  ClusterProxmoxImagesAssignRequest,
  ClusterProxmoxImagesAssignResponse,
  ClusterProxmoxImagesCreateRequest,
  ClusterProxmoxImagesCreateResponse,
  ClusterProxmoxImagesUnassignRequest,
  ClusterProxmoxImagesUnassignResponse,
  ClusterProxmoxImagesUpdateAssignedRequest,
  ClusterProxmoxImagesUpdateAssignedResponse,
  ClusterProxmoxNodesListRequest,
  ClusterProxmoxNodesListResponse,
  ClusterProxmoxNodesRegisterRequest,
  ClusterProxmoxNodesRegisterResponse,
  ClusterProxmoxNodesUnregisterAllRequest,
  ClusterProxmoxNodesUnregisterAllResponse,
  ClusterProxmoxNodesUnregisterRequest,
  ClusterProxmoxNodesUnregisterResponse,
  ClusterProxmoxNodesUpdateRequest,
  ClusterProxmoxNodesUpdateResponse,
  ClusterProxmoxProvisioningApplyRequest,
  ClusterProxmoxProvisioningApplyResponse,
  ClusterProxmoxProvisioningDestroyRequest,
  ClusterProxmoxProvisioningDestroyResponse,
  ClusterProxmoxProvisioningPlanRequest,
  ClusterProxmoxProvisioningPlanResponse,
  ClusterProxmoxProvisionRequest,
  ClusterProxmoxProvisionResponse,
  ClusterProxmoxStorageByNodeRequest,
  ClusterProxmoxStorageByNodeResponse,
  ClusterProxmoxTestConnectionRequest,
  ClusterProxmoxTestConnectionResponse,
  ClusterProxmoxVirtualMachineListRequest,
  ClusterProxmoxVirtualMachineListResponse,
  ClusterProxmoxVirtualMachineMetricsRequest,
  ClusterProxmoxVirtualMachineMetricsResponse,
  ClusterProxmoxVirtualMachineRegisterRequest,
  ClusterProxmoxVirtualMachineRegisterResponse,
  ClusterProxmoxVirtualMachineTagsRequest,
  ClusterProxmoxVirtualMachineTagsResponse,
  ClusterProxmoxVirtualMachineUnregisterAllRequest,
  ClusterProxmoxVirtualMachineUnregisterAllResponse,
  ClusterProxmoxVirtualMachineUnregisterRequest,
  ClusterProxmoxVirtualMachineUnregisterResponse,
  ClusterProxmoxVirtualMachineUpdateRequest,
  ClusterProxmoxVirtualMachineUpdateResponse,
  ClusterRegisterRequest,
  ClusterRegisterResponse,
  ClusterUnregisterRequest,
  ClusterUnregisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { ExecutionEventNotification } from "@jsonrpc-contracts-ts/executions.gen.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";

/**
 * Integration for the long-running `cluster.proxmox.*` RPC surface used
 * by the provisioning UI.
 *
 * `provisioningPlan/Apply/Destroy` return `{ executionId }` immediately
 * (the work runs server-side); the UI attaches to progress via
 * `ExecutionsIntegration.watch({ executionId })` for the log/step
 * stream and `ClusterEventIntegration.watch({ clusterId })` for
 * per-node lifecycle. `imagesCreate` is the pre-apply step that
 * materializes a node image (also long-running; returns an Ack —
 * progress flows on the same execution channel).
 *
 * Every method is protected — the caller includes a valid sessionId.
 */
export class ClusterIntegration {
  constructor(private readonly rpc: Client) {}

  list(request: ClusterListRequest): Promise<ClusterListResponse> {
    return this.rpc.invoke<ClusterListResponse>("cluster.list", request);
  }

  byId(request: ClusterByIdRequest): Promise<ClusterByIdResponse> {
    return this.rpc.invoke<ClusterByIdResponse>("cluster.byId", request);
  }

  listProviders(
    request: ClusterProvidersListRequest,
  ): Promise<ClusterProvidersListResponse> {
    return this.rpc.invoke<ClusterProvidersListResponse>("cluster.providers.list", request);
  }

  listOperatingSystems(
    request: ClusterOperatingSystemsListRequest,
  ): Promise<ClusterOperatingSystemsListResponse> {
    return this.rpc.invoke<ClusterOperatingSystemsListResponse>(
      "cluster.operatingSystems.list",
      request,
    );
  }

  register(request: ClusterRegisterRequest): Promise<ClusterRegisterResponse> {
    return this.rpc.invoke<ClusterRegisterResponse>("cluster.register", request);
  }

  unregister(
    request: ClusterUnregisterRequest,
  ): Promise<ClusterUnregisterResponse> {
    return this.rpc.invoke<ClusterUnregisterResponse>(
      "cluster.unregister",
      request,
    );
  }

  nodesList(
    request: ClusterProxmoxNodesListRequest,
  ): Promise<ClusterProxmoxNodesListResponse> {
    return this.rpc.invoke<ClusterProxmoxNodesListResponse>(
      "cluster.proxmox.nodes.list",
      request,
    );
  }

  connectionsList(
    request: ClusterProxmoxConnectionsListRequest,
  ): Promise<ClusterProxmoxConnectionsListResponse> {
    return this.rpc.invoke<ClusterProxmoxConnectionsListResponse>(
      "cluster.proxmox.connections.list",
      request,
    );
  }

  imagesList(
    request: ClusterImagesListRequest,
  ): Promise<ClusterImagesListResponse> {
    return this.rpc.invoke<ClusterImagesListResponse>(
      "cluster.images.list",
      request,
    );
  }

  nodesRegister(
    request: ClusterProxmoxNodesRegisterRequest,
  ): Promise<ClusterProxmoxNodesRegisterResponse> {
    return this.rpc.invoke<ClusterProxmoxNodesRegisterResponse>(
      "cluster.proxmox.nodes.register",
      request,
    );
  }

  /**
   * One-shot SSH bootstrap: reads the node's vault credentials, opens a
   * password SSH connection to the host, and installs the local
   * DevStation public key in `authorized_keys`. Idempotent — calling
   * twice is a no-op (`alreadyPresent` flips to true on the second
   * call). Must run BEFORE any image/provision step so the engine's
   * key-only SSH (`SshCli`) can authenticate.
   */
  bootstrapKey(
    request: ClusterConnectionBootstrapKeyRequest,
  ): Promise<ClusterConnectionBootstrapKeyResponse> {
    return this.rpc.invoke<ClusterConnectionBootstrapKeyResponse>(
      "cluster.connection.bootstrapKey",
      request,
    );
  }

  nodesUpdate(
    request: ClusterProxmoxNodesUpdateRequest,
  ): Promise<ClusterProxmoxNodesUpdateResponse> {
    return this.rpc.invoke<ClusterProxmoxNodesUpdateResponse>(
      "cluster.proxmox.nodes.update",
      request,
    );
  }

  nodesUnregister(
    request: ClusterProxmoxNodesUnregisterRequest,
  ): Promise<ClusterProxmoxNodesUnregisterResponse> {
    return this.rpc.invoke<ClusterProxmoxNodesUnregisterResponse>(
      "cluster.proxmox.nodes.unregister",
      request,
    );
  }

  nodesUnregisterAll(
    request: ClusterProxmoxNodesUnregisterAllRequest,
  ): Promise<ClusterProxmoxNodesUnregisterAllResponse> {
    return this.rpc.invoke<ClusterProxmoxNodesUnregisterAllResponse>(
      "cluster.proxmox.nodes.unregisterAll",
      request,
    );
  }

  connect(
    request: ClusterProxmoxConnectRequest,
  ): Promise<ClusterProxmoxConnectResponse> {
    return this.rpc.invoke<ClusterProxmoxConnectResponse>(
      "cluster.proxmox.connect",
      request,
    );
  }

  testConnection(
    request: ClusterProxmoxTestConnectionRequest,
  ): Promise<ClusterProxmoxTestConnectionResponse> {
    return this.rpc.invoke<ClusterProxmoxTestConnectionResponse>(
      "cluster.proxmox.testConnection",
      request,
    );
  }

  disconnect(
    request: ClusterProxmoxDisconnectRequest,
  ): Promise<ClusterProxmoxDisconnectResponse> {
    return this.rpc.invoke<ClusterProxmoxDisconnectResponse>(
      "cluster.proxmox.disconnect",
      request,
    );
  }

  provision(
    request: ClusterProxmoxProvisionRequest,
  ): Promise<ClusterProxmoxProvisionResponse> {
    return this.rpc.invoke<ClusterProxmoxProvisionResponse>(
      "cluster.proxmox.provision",
      request,
    );
  }

  vmList(
    request: ClusterProxmoxVirtualMachineListRequest,
  ): Promise<ClusterProxmoxVirtualMachineListResponse> {
    return this.rpc.invoke<ClusterProxmoxVirtualMachineListResponse>(
      "cluster.proxmox.virtualMachine.list",
      request,
    );
  }

  vmTags(
    request: ClusterProxmoxVirtualMachineTagsRequest,
  ): Promise<ClusterProxmoxVirtualMachineTagsResponse> {
    return this.rpc.invoke<ClusterProxmoxVirtualMachineTagsResponse>(
      "cluster.proxmox.virtualMachine.tags",
      request,
    );
  }

  vmRegister(
    request: ClusterProxmoxVirtualMachineRegisterRequest,
  ): Promise<ClusterProxmoxVirtualMachineRegisterResponse> {
    return this.rpc.invoke<ClusterProxmoxVirtualMachineRegisterResponse>(
      "cluster.proxmox.virtualMachine.register",
      request,
    );
  }

  vmUpdate(
    request: ClusterProxmoxVirtualMachineUpdateRequest,
  ): Promise<ClusterProxmoxVirtualMachineUpdateResponse> {
    return this.rpc.invoke<ClusterProxmoxVirtualMachineUpdateResponse>(
      "cluster.proxmox.virtualMachine.update",
      request,
    );
  }

  vmMetrics(
    request: ClusterProxmoxVirtualMachineMetricsRequest,
  ): Promise<ClusterProxmoxVirtualMachineMetricsResponse> {
    return this.rpc.invoke<ClusterProxmoxVirtualMachineMetricsResponse>(
      "cluster.proxmox.virtualMachine.metrics",
      request,
    );
  }

  vmUnregister(
    request: ClusterProxmoxVirtualMachineUnregisterRequest,
  ): Promise<ClusterProxmoxVirtualMachineUnregisterResponse> {
    return this.rpc.invoke<ClusterProxmoxVirtualMachineUnregisterResponse>(
      "cluster.proxmox.virtualMachine.unregister",
      request,
    );
  }

  vmUnregisterAll(
    request: ClusterProxmoxVirtualMachineUnregisterAllRequest,
  ): Promise<ClusterProxmoxVirtualMachineUnregisterAllResponse> {
    return this.rpc.invoke<ClusterProxmoxVirtualMachineUnregisterAllResponse>(
      "cluster.proxmox.virtualMachine.unregisterAll",
      request,
    );
  }

  imagesAssign(
    request: ClusterProxmoxImagesAssignRequest,
  ): Promise<ClusterProxmoxImagesAssignResponse> {
    return this.rpc.invoke<ClusterProxmoxImagesAssignResponse>(
      "cluster.proxmox.images.assign",
      request,
    );
  }

  imagesUpdateAssigned(
    request: ClusterProxmoxImagesUpdateAssignedRequest,
  ): Promise<ClusterProxmoxImagesUpdateAssignedResponse> {
    return this.rpc.invoke<ClusterProxmoxImagesUpdateAssignedResponse>(
      "cluster.proxmox.images.updateAssigned",
      request,
    );
  }

  storageByNode(
    request: ClusterProxmoxStorageByNodeRequest,
  ): Promise<ClusterProxmoxStorageByNodeResponse> {
    return this.rpc.invoke<ClusterProxmoxStorageByNodeResponse>(
      "cluster.proxmox.storage.byNode",
      request,
    );
  }

  imagesUnassign(
    request: ClusterProxmoxImagesUnassignRequest,
  ): Promise<ClusterProxmoxImagesUnassignResponse> {
    return this.rpc.invoke<ClusterProxmoxImagesUnassignResponse>(
      "cluster.proxmox.images.unassign",
      request,
    );
  }

  provisioningPlan(
    request: ClusterProxmoxProvisioningPlanRequest,
  ): Promise<ClusterProxmoxProvisioningPlanResponse> {
    return this.rpc.invoke<ClusterProxmoxProvisioningPlanResponse>(
      "cluster.proxmox.provisioning.plan",
      request,
    );
  }

  provisioningApply(
    request: ClusterProxmoxProvisioningApplyRequest,
  ): Promise<ClusterProxmoxProvisioningApplyResponse> {
    return this.rpc.invoke<ClusterProxmoxProvisioningApplyResponse>(
      "cluster.proxmox.provisioning.apply",
      request,
    );
  }

  provisioningDestroy(
    request: ClusterProxmoxProvisioningDestroyRequest,
  ): Promise<ClusterProxmoxProvisioningDestroyResponse> {
    return this.rpc.invoke<ClusterProxmoxProvisioningDestroyResponse>(
      "cluster.proxmox.provisioning.destroy",
      request,
    );
  }

  /**
   * `imagesCreate` is LSP-style: the request stays pending while the
   * server materializes the image (download cloud image + qm
   * create/importdisk/template over SSH) and resolves with an Ack on
   * success. When `onLog` is given, the server's Step/Log events —
   * delivered as `execution.event` notifications for the executionId
   * announced via `operation.started` — are forwarded so the otherwise
   * multi-minute silent download shows progress.
   */
  imagesCreate(
    request: ClusterProxmoxImagesCreateRequest,
    onLog?: (line: string) => void,
  ): Promise<ClusterProxmoxImagesCreateResponse> {
    if (!onLog) {
      return this.rpc.invoke<ClusterProxmoxImagesCreateResponse>(
        "cluster.proxmox.images.create",
        request,
      );
    }
    let executionId: string | null = null;
    const offStarted = this.rpc.onNotification<{ executionId: string }>(
      "operation.started",
      (p) => {
        executionId = p.executionId;
      },
    );
    const offEvent = this.rpc.onNotification<ExecutionEventNotification>(
      "execution.event",
      (p) => {
        if (executionId !== null && p.executionId !== executionId) return;
        const e = p.event;
        if (e.type === "log") {
          if (e.line) onLog(e.line);
        } else if (e.type === "step") {
          onLog(`▼ ${e.name}${e.detail ? ` — ${e.detail}` : ""}`);
        }
      },
    );
    return this.rpc
      .invoke<ClusterProxmoxImagesCreateResponse>(
        "cluster.proxmox.images.create",
        request,
      )
      .finally(() => {
        offStarted();
        offEvent();
      });
  }
}
