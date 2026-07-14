import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import type {
  AuthenticatedSession,
  Authentication,
} from "@server/shared/authentication/domain/ports/outbound/authentication.ts";
import { Server } from "@server/shared/inbound/rpc/server.ts";
import { EndpointRegistry } from "@server/shared/inbound/rpc/endpoint/endpoint-registry.ts";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Channel } from "@jsonrpc-client-ts/channel.ts";
import type { Notification } from "@jsonrpc-client-ts/envelope/notification.ts";
import type { Request } from "@jsonrpc-client-ts/envelope/request.ts";
import type { Response } from "@jsonrpc-client-ts/envelope/response/response.ts";
import type { ClusterProxmoxProvisioningPlanResponse } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { InMemoryExecutions } from "@server/shared/executions/outbound/in-memory-executions.ts";
import { PlanEndpoint } from "@server/cluster/inbound/rpc/proxmox/provisioning/plan/endpoint.ts";
import { PlanNodesHandler } from "@server/cluster/application/handlers/proxmox/provisioning/plan-nodes-handler.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";
import type { Provisioning } from "@server/cluster/domain/ports/outbound/executions/proxmox/provisioning/provisioning.ts";
import { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import { Id as ClusterId } from "@server/cluster/domain/models/id.ts";
import { Name as ClusterName } from "@server/cluster/domain/models/name.ts";
import { Name as NodeName } from "@server/cluster/domain/models/proxmox/nodes/name.ts";
import { Ip as NodeIp } from "@server/cluster/domain/models/proxmox/nodes/ip.ts";
import { Node as ProxmoxNode } from "@server/cluster/domain/models/proxmox/nodes/node.ts";
import { Nodes as ProxmoxNodes } from "@server/cluster/domain/models/proxmox/nodes/nodes.ts";
import { NodeImages } from "@server/cluster/domain/models/proxmox/nodes/images/node-images.ts";
import { VirtualMachines } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/virtual-machines.ts";
import { Credential } from "@server/shared/building-blocks/domain/models/value-objects/credential.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import type { Cluster } from "@server/cluster/domain/models/cluster.ts";
import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import type { Task } from "@server/shared/executions/domain/models/task.ts";
import type { ExecutionEvent as DomainExecutionEvent } from "@server/shared/executions/domain/events/event.ts";
import { emitFrom } from "@server/shared/executions/outbound/streaming/emit-from.ts";
import { Log } from "@jsonrpc-contracts-ts/executions.gen.ts";
import { Step } from "@jsonrpc-contracts-ts/executions.gen.ts";

const SESSION_ID = "00000000-0000-0000-0000-000000000001";
const SESSION_KEY = "a".repeat(64);

class StubAuthentication implements Authentication {
  check(_: string): AuthenticatedSession {
    return { sessionId: SESSION_ID, key: SESSION_KEY, expiresAt: new Date(Date.now() + 60_000) };
  }
}

const credential = () =>
  new Credential(
    new Vault("00000000-0000-0000-0000-000000000001"),
    new Secret("00000000-0000-0000-0000-000000000002"),
    new Secret("00000000-0000-0000-0000-000000000003"),
  );

const makeCluster = () =>
  new ProxmoxCluster(
    new ClusterId("homelab"),
    new ClusterName("homelab"),
    new Creation(
      new User("alice"),
      new Hostname("host"),
      Instant.fromString("2026-01-01T00:00:00.000Z"),
    ),
    new ProxmoxNodes([
      new ProxmoxNode(
        new NodeId("web"),
        new NodeName("web"),
        new NodeIp("10.0.0.10"),
        credential(),
        new NodeImages(),
        new VirtualMachines(),
      ),
      new ProxmoxNode(
        new NodeId("db"),
        new NodeName("db"),
        new NodeIp("10.0.0.11"),
        credential(),
        new NodeImages(),
        new VirtualMachines(),
      ),
    ]),
  );

class StubClusters implements Clusters {
  private readonly cluster = makeCluster();
  of<T extends Cluster>(_id: unknown): Promise<T> {
    return Promise.resolve(this.cluster as unknown as T);
  }
  byName(): Promise<never> {
    throw new Error("not used");
  }
  all(): Promise<never> {
    throw new Error("not used");
  }
  add(): Promise<never> {
    throw new Error("not used");
  }
  async update<T extends Cluster>(
    _id: unknown,
    change: (c: T) => void | Promise<void>,
  ): Promise<T> {
    await change(this.cluster as unknown as T);
    return this.cluster as unknown as T;
  }
  exists(): Promise<never> {
    throw new Error("not used");
  }
  remove(): Promise<never> {
    throw new Error("not used");
  }
}

class StubDispatcher implements Dispatcher {
  dispatch(): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * Stub Provisioning port — per-node, emits a canned sequence of events that
 * mirrors what the real provisioning-adapter would yield. The handler iterates
 * over node ids and calls this stub once per node.
 */
class StubProvisioning implements Provisioning {
  plan(_cluster: ProxmoxCluster, nodeIds: NodeId[]): Task {
    const name = nodeIds[0].value;
    return {
      run: (_op, emitter) =>
        emitFrom(
          (async function* (): AsyncIterable<DomainExecutionEvent> {
            if (name === "web") {
              yield new Step("plan", "web/prod");
              yield new Log("Initializing the backend...");
              yield new Log("Provisioning has been successfully initialized!");
              yield new Log("✓ web/prod: +2 ~0 -0");
            } else {
              yield new Step("plan", "db/prod");
              yield new Log("Initializing the backend...");
              yield new Log("✓ db/prod: +1 ~0 -0");
            }
          })(),
          emitter,
        ),
    };
  }
  apply(): Task {
    throw new Error("not used");
  }
  destroy(): Task {
    throw new Error("not used");
  }
}

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

class InProcessChannel implements Channel {
  private readonly handlers = new Set<(n: Notification) => void>();
  constructor(private readonly server: Server) {}
  send(request: Request): Promise<Response> {
    // deno-lint-ignore require-await -- callback satisfies the async NotificationSender port
    return this.server.handle(request, async (n) => {
      for (const h of this.handlers) h(n);
    });
  }
  onNotification(handler: (n: Notification) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}

describe("cluster.proxmox.provisioning.plan endpoint — integration", () => {
  let rpc: Client;

  beforeAll(() => {
    const operations = new InMemoryExecutions();
    // Handler wired with stubbed Clusters + Provisioning; endpoint receives
    // the handler — endpoint stays thin (no Executions/Clusters access).
    const handler = new PlanNodesHandler(
      new StubClusters(),
      operations,
      new StubProvisioning(),
      new StubDispatcher(),
    );
    const endpoint = new PlanEndpoint(handler);

    const server = new Server(
      EndpointRegistry.empty(new StubAuthentication()).protected(endpoint),
      silentLogger,
      "test-core",
    );
    rpc = new Client(new InProcessChannel(server));
  });

  afterAll(() => {});

  it("acknowledges the request with an executionId so the UI can attach via operation.watch", async () => {
    /* @When the client invokes cluster.proxmox.provisioning.plan */
    const response = await rpc.invoke<ClusterProxmoxProvisioningPlanResponse>(
      "cluster.proxmox.provisioning.plan",
      { sessionId: SESSION_ID, clusterId: "homelab", nodeIds: ["web", "db"] },
    );

    /* @Then the response carries an executionId — UI uses it on operation.watch */
    assertEquals(typeof response.executionId, "string");
    assertEquals(response.executionId.length > 0, true);
  });
});
