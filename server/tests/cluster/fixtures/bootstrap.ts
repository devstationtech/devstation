import { Container } from "@server/container.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { FileLogger } from "@server/shared/observability/outbound/file-logger.ts";
import { Server } from "@server/shared/inbound/rpc/server.ts";
import { EndpointRegistry } from "@server/shared/inbound/rpc/endpoint/endpoint-registry.ts";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import type {
  AuthenticatedSession,
  Authentication,
} from "@server/shared/authentication/domain/ports/outbound/authentication.ts";
import {
  AcknowledgeInterruptionEndpoint,
  AssignImageEndpoint,
  ClusterByIdEndpoint,
  ConnectClusterEndpoint,
  DisconnectClusterEndpoint,
  ListClustersEndpoint,
  ListImagesEndpoint,
  ListProxmoxConnectionsEndpoint,
  ProxmoxProvisionEndpoint,
  RegisterClusterEndpoint,
  RegisterNodeEndpoint,
  RegisterVirtualMachineEndpoint,
  TestProxmoxConnectionEndpoint,
  UnassignImageEndpoint,
  UnregisterAllNodesEndpoint,
  UnregisterAllVirtualMachinesEndpoint,
  UnregisterClusterEndpoint,
  UnregisterNodeEndpoint,
  UnregisterVirtualMachineEndpoint,
  UpdateAssignedImageEndpoint,
  UpdateNodeEndpoint,
  UpdateVirtualMachineEndpoint,
} from "@server/cluster/inbound/rpc/endpoints.ts";
import { Query as TestProxmoxConnectionQuery } from "@server/cluster/application/queries/proxmox/test-connection/query.ts";
import { Query as ProvisionQuery } from "@server/cluster/application/queries/proxmox/provision/query.ts";
import { Query as AllImagesQuery } from "@server/cluster/application/queries/images/all/query.ts";
import { Query as AllConnectionsQuery } from "@server/cluster/application/queries/proxmox/connection/all/query.ts";
import { Adapter } from "@server/cluster/outbound/persistence/file-system/adapter.ts";
import { Query } from "@server/cluster/application/queries/all/query.ts";
import { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { RegisterClusterHandler } from "@server/cluster/application/handlers/proxmox/register-cluster-handler.ts";
import { UnregisterClusterHandler } from "@server/cluster/application/handlers/proxmox/unregister-cluster-handler.ts";
import { ConnectClusterHandler } from "@server/cluster/application/handlers/proxmox/connect-cluster-handler.ts";
import { DisconnectClusterHandler } from "@server/cluster/application/handlers/proxmox/disconnect-cluster-handler.ts";
import { AssignImageHandler } from "@server/cluster/application/handlers/proxmox/assign-image-handler.ts";
import { UnassignImageHandler } from "@server/cluster/application/handlers/proxmox/unassign-image-handler.ts";
import { UpdateAssignedImageHandler } from "@server/cluster/application/handlers/proxmox/update-assigned-image-handler.ts";
import { RegisterNodeHandler } from "@server/cluster/application/handlers/proxmox/register-node-handler.ts";
import { UpdateNodeHandler } from "@server/cluster/application/handlers/proxmox/update-node-handler.ts";
import { UnregisterNodeHandler } from "@server/cluster/application/handlers/proxmox/unregister-node-handler.ts";
import { UnregisterAllNodesHandler } from "@server/cluster/application/handlers/proxmox/unregister-all-nodes-handler.ts";
import { AcknowledgeInterruptionHandler } from "@server/cluster/application/handlers/proxmox/acknowledge-interruption-handler.ts";
import { RegisterVirtualMachineHandler } from "@server/cluster/application/handlers/proxmox/register-virtual-machine-handler.ts";
import { UpdateVirtualMachineHandler } from "@server/cluster/application/handlers/proxmox/update-virtual-machine-handler.ts";
import { UnregisterVirtualMachineHandler } from "@server/cluster/application/handlers/proxmox/unregister-virtual-machine-handler.ts";
import { UnregisterAllVirtualMachinesHandler } from "@server/cluster/application/handlers/proxmox/unregister-all-virtual-machines-handler.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

export const STUB_SESSION_ID = "00000000-0000-0000-0000-000000000001";
export const STUB_SESSION_KEY = "a".repeat(64);

export class StubAuthentication implements Authentication {
  check(_sessionId: string): AuthenticatedSession {
    return {
      sessionId: STUB_SESSION_ID,
      key: STUB_SESSION_KEY,
      expiresAt: new Date(Date.now() + 60_000),
    };
  }
}

export function testContainer(): Container {
  return new Container()
    .register(Persistence, () => new Persistence())
    .register(FileSystem, (c) => new FileSystem(c.get(Persistence).dir))
    .register(FileLogger, (c) => new FileLogger(new FileSystem(c.get(Persistence).dir)))
    .register(Adapter, (c) => new Adapter(c.get(FileSystem), c.get(FileLogger)))
    .register(Query, (c) => new Query(c.get(FileSystem)))
    .register(ClusterByIdQuery, (c) => new ClusterByIdQuery(c.get(FileSystem)))
    .register(RegisterClusterHandler, (c) => new RegisterClusterHandler(c.get(Adapter)))
    .register(UnregisterClusterHandler, (c) => new UnregisterClusterHandler(c.get(Adapter)))
    .register(RegisterNodeHandler, (c) => new RegisterNodeHandler(c.get(Adapter)))
    .register(UpdateNodeHandler, (c) => new UpdateNodeHandler(c.get(Adapter)))
    .register(UnregisterNodeHandler, (c) => new UnregisterNodeHandler(c.get(Adapter)))
    .register(UnregisterAllNodesHandler, (c) => new UnregisterAllNodesHandler(c.get(Adapter)))
    .register(
      RegisterVirtualMachineHandler,
      (c) => new RegisterVirtualMachineHandler(c.get(Adapter)),
    )
    .register(UpdateVirtualMachineHandler, (c) => new UpdateVirtualMachineHandler(c.get(Adapter)))
    .register(
      UnregisterVirtualMachineHandler,
      (c) => new UnregisterVirtualMachineHandler(c.get(Adapter)),
    )
    .register(
      UnregisterAllVirtualMachinesHandler,
      (c) => new UnregisterAllVirtualMachinesHandler(c.get(Adapter)),
    )
    .register(StubAuthentication, () => new StubAuthentication())
    .register(
      ConnectClusterHandler,
      (c) =>
        new ConnectClusterHandler(
          c.get(Adapter),
          // Stub probe that always succeeds — production injection
          // wires the real SecretResolver + ProxmoxIntegration. Tests
          // that exercise the probe failure path should override this
          // registration locally.
          { resolve: () => Promise.resolve("stub-token") },
          () => ({ clusterResources: () => Promise.resolve([]) }) as never,
        ),
    )
    .register(DisconnectClusterHandler, (c) => new DisconnectClusterHandler(c.get(Adapter)))
    .register(AssignImageHandler, (c) => new AssignImageHandler(c.get(Adapter)))
    .register(UnassignImageHandler, (c) => new UnassignImageHandler(c.get(Adapter)))
    .register(UpdateAssignedImageHandler, (c) => new UpdateAssignedImageHandler(c.get(Adapter)))
    .register(
      RegisterClusterEndpoint,
      (c) => new RegisterClusterEndpoint(c.get(RegisterClusterHandler)),
    )
    .register(
      UnregisterClusterEndpoint,
      (c) => new UnregisterClusterEndpoint(c.get(UnregisterClusterHandler)),
    )
    .register(
      ConnectClusterEndpoint,
      (c) => new ConnectClusterEndpoint(c.get(ConnectClusterHandler)),
    )
    .register(
      DisconnectClusterEndpoint,
      (c) => new DisconnectClusterEndpoint(c.get(DisconnectClusterHandler)),
    )
    .register(
      RegisterNodeEndpoint,
      (c) => new RegisterNodeEndpoint(c.get(RegisterNodeHandler)),
    )
    .register(
      UpdateNodeEndpoint,
      (c) => new UpdateNodeEndpoint(c.get(UpdateNodeHandler)),
    )
    .register(
      UnregisterNodeEndpoint,
      (c) => new UnregisterNodeEndpoint(c.get(UnregisterNodeHandler)),
    )
    .register(
      UnregisterAllNodesEndpoint,
      (c) => new UnregisterAllNodesEndpoint(c.get(UnregisterAllNodesHandler)),
    )
    .register(
      AcknowledgeInterruptionHandler,
      (c) => new AcknowledgeInterruptionHandler(c.get(Adapter)),
    )
    .register(
      AcknowledgeInterruptionEndpoint,
      (c) => new AcknowledgeInterruptionEndpoint(c.get(AcknowledgeInterruptionHandler)),
    )
    .register(AssignImageEndpoint, (c) => new AssignImageEndpoint(c.get(AssignImageHandler)))
    .register(
      UnassignImageEndpoint,
      (c) => new UnassignImageEndpoint(c.get(UnassignImageHandler)),
    )
    .register(
      UpdateAssignedImageEndpoint,
      (c) => new UpdateAssignedImageEndpoint(c.get(UpdateAssignedImageHandler)),
    )
    .register(
      RegisterVirtualMachineEndpoint,
      (c) => new RegisterVirtualMachineEndpoint(c.get(RegisterVirtualMachineHandler)),
    )
    .register(
      UpdateVirtualMachineEndpoint,
      (c) => new UpdateVirtualMachineEndpoint(c.get(UpdateVirtualMachineHandler)),
    )
    .register(
      UnregisterVirtualMachineEndpoint,
      (c) => new UnregisterVirtualMachineEndpoint(c.get(UnregisterVirtualMachineHandler)),
    )
    .register(
      UnregisterAllVirtualMachinesEndpoint,
      (c) =>
        new UnregisterAllVirtualMachinesEndpoint(
          c.get(UnregisterAllVirtualMachinesHandler),
        ),
    )
    .register(ListClustersEndpoint, (c) => new ListClustersEndpoint(c.get(Query)))
    .register(AllImagesQuery, (c) => new AllImagesQuery(c.get(FileSystem)))
    .register(ListImagesEndpoint, (c) => new ListImagesEndpoint(c.get(AllImagesQuery)))
    .register(AllConnectionsQuery, (c) => new AllConnectionsQuery(c.get(FileSystem)))
    .register(
      ListProxmoxConnectionsEndpoint,
      (c) => new ListProxmoxConnectionsEndpoint(c.get(AllConnectionsQuery)),
    )
    .register(ClusterByIdEndpoint, (c) => new ClusterByIdEndpoint(c.get(ClusterByIdQuery)))
    .register(TestProxmoxConnectionQuery, () => new TestProxmoxConnectionQuery())
    .register(
      TestProxmoxConnectionEndpoint,
      (c) => new TestProxmoxConnectionEndpoint(c.get(TestProxmoxConnectionQuery)),
    )
    .register(ProvisionQuery, (c) => new ProvisionQuery(c.get(FileSystem)))
    .register(
      ProxmoxProvisionEndpoint,
      (c) => new ProxmoxProvisionEndpoint(c.get(ProvisionQuery)),
    )
    .build();
}

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

/**
 * Builds an in-process Client wired to a Server with the cluster RPC
 * endpoints registered. Endpoint integration tests use this to exercise
 * the JSON-RPC envelope, method routing, the Authenticated decorator and
 * error mapping without spawning a subprocess.
 */
export function buildClient(container: Container): Client {
  const server = new Server(
    EndpointRegistry.empty(container.get(StubAuthentication))
      .protected(container.get(RegisterClusterEndpoint))
      .protected(container.get(UnregisterClusterEndpoint))
      .protected(container.get(ConnectClusterEndpoint))
      .protected(container.get(DisconnectClusterEndpoint))
      .protected(container.get(RegisterNodeEndpoint))
      .protected(container.get(UpdateNodeEndpoint))
      .protected(container.get(UnregisterNodeEndpoint))
      .protected(container.get(UnregisterAllNodesEndpoint))
      .protected(container.get(AcknowledgeInterruptionEndpoint))
      .protected(container.get(AssignImageEndpoint))
      .protected(container.get(UnassignImageEndpoint))
      .protected(container.get(UpdateAssignedImageEndpoint))
      .protected(container.get(RegisterVirtualMachineEndpoint))
      .protected(container.get(UpdateVirtualMachineEndpoint))
      .protected(container.get(UnregisterVirtualMachineEndpoint))
      .protected(container.get(UnregisterAllVirtualMachinesEndpoint))
      .protected(container.get(ListClustersEndpoint))
      .protected(container.get(ListImagesEndpoint))
      .protected(container.get(ListProxmoxConnectionsEndpoint))
      .protected(container.get(ClusterByIdEndpoint))
      .protected(container.get(TestProxmoxConnectionEndpoint))
      .protected(container.get(ProxmoxProvisionEndpoint)),
    silentLogger,
    "test-core",
  );
  return new Client((request) => server.handle(request));
}
