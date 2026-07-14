import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Channel } from "@jsonrpc-client-ts/channel.ts";
import type { Request } from "@jsonrpc-client-ts/envelope/request.ts";
import type { Response } from "@jsonrpc-client-ts/envelope/response/response.ts";
import { BlueprintIntegration } from "@ui/shared/integrations/blueprint-integration.ts";

/** Records the last request and replies with a canned result. */
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

describe("BlueprintIntegration — UI invokes blueprint RPC", () => {
  it("list invokes blueprint.list and returns the catalog", async () => {
    /* @Given a recording channel returning a one-entry catalog */
    const channel = new RecordingChannel([{ id: "docker", name: "docker" }]);
    const blueprint = new BlueprintIntegration(new Client(channel));

    /* @When list is called */
    const res = await blueprint.list({ sessionId: "s" });

    /* @Then it invokes blueprint.list and returns the catalog */
    assertEquals(channel.last?.method, "blueprint.list");
    assertEquals(channel.last?.params, { sessionId: "s" });
    assertEquals(res.length, 1);
    assertEquals(res[0].id, "docker");
  });

  it("byId invokes blueprint.byId with the id", async () => {
    /* @Given a recording channel returning a single blueprint */
    const channel = new RecordingChannel({ id: "docker", name: "docker" });
    const blueprint = new BlueprintIntegration(new Client(channel));

    /* @When byId is called with an id */
    const res = await blueprint.byId({ sessionId: "s", id: "docker" });

    /* @Then it invokes blueprint.byId with that id and returns the record */
    assertEquals(channel.last?.method, "blueprint.byId");
    assertEquals(channel.last?.params, { sessionId: "s", id: "docker" });
    assertEquals(res.id, "docker");
  });
});
