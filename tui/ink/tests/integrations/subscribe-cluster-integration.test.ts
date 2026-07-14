import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Channel } from "@jsonrpc-client-ts/channel.ts";
import type { Request } from "@jsonrpc-client-ts/envelope/request.ts";
import type { Response } from "@jsonrpc-client-ts/envelope/response/response.ts";
import { ClusterIntegration } from "@ui/shared/integrations/cluster-integration.ts";

/** Records the last request and Acks it with a canned result. */
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

describe("ClusterIntegration — UI invokes long-running cluster RPC", () => {
  it("provisioningPlan invokes cluster.proxmox.provisioning.plan and returns executionId", async () => {
    /* @Given a recording channel returning an executionId */
    const channel = new RecordingChannel({ executionId: "exec-1" });
    const cluster = new ClusterIntegration(new Client(channel));

    /* @When provisioningPlan is called */
    const res = await cluster.provisioningPlan({
      sessionId: "s",
      clusterId: "c1",
      nodeIds: ["n1", "n2"],
    });

    /* @Then it invokes cluster.proxmox.provisioning.plan and returns the executionId */
    assertEquals(channel.last?.method, "cluster.proxmox.provisioning.plan");
    assertEquals(channel.last?.params, { sessionId: "s", clusterId: "c1", nodeIds: ["n1", "n2"] });
    assertEquals(res.executionId, "exec-1");
  });

  it("provisioningApply / provisioningDestroy route to their methods", async () => {
    /* @Given/@When provisioningApply is called */
    const apply = new RecordingChannel({ executionId: "a" });
    await new ClusterIntegration(new Client(apply)).provisioningApply({
      sessionId: "s",
      clusterId: "c1",
      nodeIds: ["n1"],
    });
    /* @Then it routes to cluster.proxmox.provisioning.apply */
    assertEquals(apply.last?.method, "cluster.proxmox.provisioning.apply");

    /* @And provisioningDestroy routes to its own method */
    const destroy = new RecordingChannel({ executionId: "d" });
    await new ClusterIntegration(new Client(destroy)).provisioningDestroy({
      sessionId: "s",
      clusterId: "c1",
      nodeIds: ["n1"],
    });
    assertEquals(destroy.last?.method, "cluster.proxmox.provisioning.destroy");
  });

  it("imagesCreate invokes cluster.proxmox.images.create and returns Ack", async () => {
    /* @Given a recording channel that Acks with an empty result */
    const channel = new RecordingChannel({});
    const cluster = new ClusterIntegration(new Client(channel));

    /* @When imagesCreate is called */
    const res = await cluster.imagesCreate({
      sessionId: "s",
      clusterId: "c1",
      nodeId: "n1",
      imageId: "img-1",
    });

    /* @Then it invokes cluster.proxmox.images.create and returns the Ack */
    assertEquals(channel.last?.method, "cluster.proxmox.images.create");
    assertEquals(res, {});
  });
});
