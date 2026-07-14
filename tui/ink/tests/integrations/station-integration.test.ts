import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Channel } from "@jsonrpc-client-ts/channel.ts";
import type { Request } from "@jsonrpc-client-ts/envelope/request.ts";
import type { Response } from "@jsonrpc-client-ts/envelope/response/response.ts";
import { StationIntegration } from "@ui/shared/integrations/station-integration.ts";

/**
 * StationIntegration covers 13 protected RPCs (station.* +
 * station.services.* + station.instances.list). Pin the canonical
 * subset — same defense as the other integration tests: a UI rename
 * without a server-side rename would ship silently.
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

function setup(result: unknown = {}): { station: StationIntegration; channel: RecordingChannel } {
  const channel = new RecordingChannel(result);
  return { station: new StationIntegration(new Client(channel)), channel };
}

describe("StationIntegration — station.* core methods", () => {
  it("list() → station.list and returns the records array", async () => {
    const { station, channel } = setup([{ id: "st-1", name: "homelab" }]);
    const got = await station.list({ sessionId: "s" });
    assertEquals(channel.last?.method, "station.list");
    assertEquals(got.length, 1);
  });

  it("byId() → station.byId with id on the wire", async () => {
    const { station, channel } = setup({ id: "st-1", name: "homelab", services: [] });
    await station.byId({ sessionId: "s", id: "st-1" });
    assertEquals(channel.last?.method, "station.byId");
    assertEquals(channel.last?.params, { sessionId: "s", id: "st-1" });
  });

  it("unregister() → station.unregister with stationId", async () => {
    const { station, channel } = setup({});
    await station.unregister({ sessionId: "s", stationId: "st-1" });
    assertEquals(channel.last?.method, "station.unregister");
    assertEquals(channel.last?.params, { sessionId: "s", stationId: "st-1" });
  });

  it("install() → station.install with the operator-selected serviceIds (returns executionId)", async () => {
    /* @Given the server returns the executionId of the install run */
    const { station, channel } = setup({ executionId: "exec-1" });
    /* @When install is invoked with a subset of service ids */
    const got = await station.install({
      sessionId: "s",
      stationId: "st-1",
      serviceIds: ["svc-a", "svc-b"],
    });
    /* @Then the method + serviceIds reach the wire and the executionId is returned */
    assertEquals(channel.last?.method, "station.install");
    assertEquals(
      (channel.last?.params as { serviceIds: readonly string[] }).serviceIds,
      ["svc-a", "svc-b"],
    );
    assertEquals(got, { executionId: "exec-1" });
  });

  it("uninstall() → station.uninstall with the operator-selected serviceIds (returns executionId)", async () => {
    /* @Given the server returns the executionId of the uninstall run */
    const { station, channel } = setup({ executionId: "exec-2" });
    /* @When uninstall is invoked with a subset of service ids */
    const got = await station.uninstall({
      sessionId: "s",
      stationId: "st-1",
      serviceIds: ["svc-a"],
    });
    /* @Then the method + serviceIds reach the wire and the executionId is returned */
    assertEquals(channel.last?.method, "station.uninstall");
    assertEquals(
      (channel.last?.params as { serviceIds: readonly string[] }).serviceIds,
      ["svc-a"],
    );
    assertEquals(got, { executionId: "exec-2" });
  });
});

describe("StationIntegration — station.services.* methods", () => {
  it("servicesList() → station.services.list", async () => {
    const { station, channel } = setup([]);
    await station.servicesList({ sessionId: "s" });
    assertEquals(channel.last?.method, "station.services.list");
  });

  it("servicesUnregister() → station.services.unregister with stationId + serviceId", async () => {
    const { station, channel } = setup({});
    await station.servicesUnregister({
      sessionId: "s",
      stationId: "st-1",
      serviceId: "svc-1",
    });
    assertEquals(channel.last?.method, "station.services.unregister");
    assertEquals(
      channel.last?.params,
      { sessionId: "s", stationId: "st-1", serviceId: "svc-1" },
    );
  });
});

describe("StationIntegration — station.instances.list", () => {
  it("instancesList() → station.instances.list", async () => {
    const { station, channel } = setup([]);
    await station.instancesList({ sessionId: "s" });
    assertEquals(channel.last?.method, "station.instances.list");
  });
});
