import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Channel } from "@jsonrpc-client-ts/channel.ts";
import type { Request } from "@jsonrpc-client-ts/envelope/request.ts";
import type { Response } from "@jsonrpc-client-ts/envelope/response/response.ts";
import { ClusterIntegration } from "@ui/shared/integrations/cluster-integration.ts";

/**
 * ClusterIntegration has ~25 methods. The existing imagesCreate test
 * covers the streaming/log-forwarding case; this file pins the core
 * CRUD + node/connection/vm RPCs the UI fires constantly. A
 * UI-side method-name typo would otherwise ship silently.
 */

class RecordingChannel implements Channel {
  last: Request | null = null;
  constructor(private readonly result: unknown) {}
  send(request: Request): Promise<Response> {
    this.last = request;
    return Promise.resolve({ jsonrpc: "2.0", id: request.id, result: this.result });
  }
  onNotification(): () => void {
    return () => {};
  }
}

function setup(result: unknown = {}) {
  const channel = new RecordingChannel(result);
  return {
    integration: new ClusterIntegration(new Client(channel)),
    channel,
  };
}

describe("ClusterIntegration — cluster.* methods", () => {
  it("list() → cluster.list", async () => {
    const { integration, channel } = setup([]);
    await integration.list({ sessionId: "s" });
    assertEquals(channel.last?.method, "cluster.list");
  });

  it("byId() → cluster.byId with the id", async () => {
    const { integration, channel } = setup({ id: "c-1", name: "homelab" });
    await integration.byId({ sessionId: "s", id: "c-1" });
    assertEquals(channel.last?.method, "cluster.byId");
    assertEquals(channel.last?.params, { sessionId: "s", id: "c-1" });
  });

  it("register() → cluster.register and forwards the body", async () => {
    const { integration, channel } = setup({ id: "c-1" });
    await integration.register({
      sessionId: "s",
      name: "homelab",
      user: "alice",
      hostname: "workstation",
    });
    assertEquals(channel.last?.method, "cluster.register");
    assertEquals((channel.last?.params as { name: string }).name, "homelab");
  });

  it("unregister() → cluster.unregister with the id", async () => {
    const { integration, channel } = setup({});
    await integration.unregister({ sessionId: "s", id: "c-1" });
    assertEquals(channel.last?.method, "cluster.unregister");
  });
});

describe("ClusterIntegration — proxmox connection methods", () => {
  it("connect() → cluster.proxmox.connect", async () => {
    const { integration, channel } = setup({});
    await integration.connect({
      sessionId: "s",
      clusterId: "c-1",
      host: "proxmox.example.com",
      vaultId: "v",
      secretId: "sec",
    });
    assertEquals(channel.last?.method, "cluster.proxmox.connect");
  });

  it("disconnect() → cluster.proxmox.disconnect", async () => {
    const { integration, channel } = setup({});
    await integration.disconnect({ sessionId: "s", clusterId: "c-1" });
    assertEquals(channel.last?.method, "cluster.proxmox.disconnect");
  });

  it("connectionsList() → cluster.proxmox.connections.list", async () => {
    const { integration, channel } = setup([]);
    await integration.connectionsList({ sessionId: "s", clusterId: "c-1" });
    assertEquals(channel.last?.method, "cluster.proxmox.connections.list");
  });

  it("testConnection() → cluster.proxmox.testConnection (returns the test result)", async () => {
    /* @Given the server returns a success result */
    const { integration, channel } = setup({ ok: true });
    /* @When the UI tests the connection without yet persisting it */
    await integration.testConnection({
      sessionId: "s",
      host: "proxmox.example.com",
      token: "tok",
    });
    /* @Then the wire method matches the contract */
    assertEquals(channel.last?.method, "cluster.proxmox.testConnection");
  });
});

describe("ClusterIntegration — proxmox node methods", () => {
  it("nodesList() → cluster.proxmox.nodes.list", async () => {
    const { integration, channel } = setup([]);
    await integration.nodesList({ sessionId: "s", clusterId: "c-1" });
    assertEquals(channel.last?.method, "cluster.proxmox.nodes.list");
  });

  it("nodesRegister() → cluster.proxmox.nodes.register and forwards the body", async () => {
    const { integration, channel } = setup({ id: "n-1" });
    await integration.nodesRegister({
      sessionId: "s",
      clusterId: "c-1",
      name: "cp4",
      ip: "192.168.15.194",
      vaultId: "v",
      usernameSecretId: "u",
      passwordSecretId: "p",
    });
    assertEquals(channel.last?.method, "cluster.proxmox.nodes.register");
    assertEquals((channel.last?.params as { ip: string }).ip, "192.168.15.194");
  });

  it("nodesUnregister() → cluster.proxmox.nodes.unregister with clusterId+nodeId", async () => {
    const { integration, channel } = setup({});
    await integration.nodesUnregister({ sessionId: "s", clusterId: "c-1", nodeId: "n-1" });
    assertEquals(channel.last?.method, "cluster.proxmox.nodes.unregister");
    assertEquals(
      channel.last?.params,
      { sessionId: "s", clusterId: "c-1", nodeId: "n-1" },
    );
  });

  // The UI calls bootstrapKey right after node register so the engine's
  // key-only SSH (`SshCli`) can authenticate from the very first image
  // refresh. Without this wiring the UX on Mac (and every fresh install)
  // was a hard "Permission denied (publickey,password)" on the first
  // image step.
  it("bootstrapKey() → cluster.connection.bootstrapKey with clusterId+nodeId", async () => {
    const { integration, channel } = setup({
      installed: true,
      alreadyPresent: false,
      pmxcfsDetected: true,
    });
    await integration.bootstrapKey({ sessionId: "s", clusterId: "c-1", nodeId: "n-1" });
    assertEquals(channel.last?.method, "cluster.connection.bootstrapKey");
    assertEquals(
      channel.last?.params,
      { sessionId: "s", clusterId: "c-1", nodeId: "n-1" },
    );
  });
});

describe("ClusterIntegration — proxmox VM methods", () => {
  it("vmList() → cluster.proxmox.virtualMachine.list with clusterId+nodeId", async () => {
    const { integration, channel } = setup([]);
    await integration.vmList({ sessionId: "s", clusterId: "c-1", nodeId: "n-1" });
    assertEquals(channel.last?.method, "cluster.proxmox.virtualMachine.list");
    assertEquals(
      channel.last?.params,
      { sessionId: "s", clusterId: "c-1", nodeId: "n-1" },
    );
  });

  it("vmTags() → cluster.proxmox.virtualMachine.tags (session-only — global tag catalog)", async () => {
    const { integration, channel } = setup({ tags: [] });
    await integration.vmTags({ sessionId: "s" });
    assertEquals(channel.last?.method, "cluster.proxmox.virtualMachine.tags");
    assertEquals(channel.last?.params, { sessionId: "s" });
  });
});
