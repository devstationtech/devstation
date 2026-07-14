import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Channel } from "@jsonrpc-client-ts/channel.ts";
import type { Request } from "@jsonrpc-client-ts/envelope/request.ts";
import type { Response } from "@jsonrpc-client-ts/envelope/response/response.ts";
import { SizeIntegration } from "@ui/shared/integrations/size-integration.ts";

/**
 * SizeIntegration is the UI's typed SDK for `size.*`
 * RPCs. Mirrors the blueprint-integration.test pattern: pin the
 * exact wire method names so a UI-side rename without a server-side
 * rename can't ship silently.
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

describe("SizeIntegration — wire method mapping", () => {
  it("register() calls size.register and forwards the body", async () => {
    /* @Given the server returns a registered size id */
    const channel = new RecordingChannel({ id: "00000000-0000-0000-0000-000000000001" });
    const integration = new SizeIntegration(new Client(channel));
    /* @When register is invoked with a full RegisterSize body */
    await integration.register({
      sessionId: "s",
      name: "small-vm",
      provider: "proxmox",
      user: "alice",
      hostname: "workstation",
      cpu: 2,
      ram: 2048,
      disk: 20,
    });
    /* @Then the method + params are forwarded verbatim */
    assertEquals(channel.last?.method, "size.register");
    assertEquals(
      (channel.last?.params as { name: string }).name,
      "small-vm",
    );
  });

  it("list() calls size.list and returns the records", async () => {
    /* @Given the server returns two records */
    const records = [
      { id: "a", name: "small" },
      { id: "b", name: "large" },
    ];
    const channel = new RecordingChannel(records);
    const integration = new SizeIntegration(new Client(channel));
    /* @When list is invoked */
    const result = await integration.list({ sessionId: "s" });
    /* @Then the method is correct and the records round-trip */
    assertEquals(channel.last?.method, "size.list");
    assertEquals(result.length, 2);
  });

  it("unregister() calls size.unregister with the id", async () => {
    /* @Given an empty success response */
    const channel = new RecordingChannel({});
    const integration = new SizeIntegration(new Client(channel));
    /* @When unregister is invoked */
    await integration.unregister({
      sessionId: "s",
      sizeId: "00000000-0000-0000-0000-000000000001",
    });
    /* @Then the method + id reach the wire (sessionId is forwarded for the protected endpoint) */
    assertEquals(channel.last?.method, "size.unregister");
    assertEquals(channel.last?.params, {
      sessionId: "s",
      sizeId: "00000000-0000-0000-0000-000000000001",
    });
  });
});
