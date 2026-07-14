import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type { SizeListResponse, SizeRegisterResponse } from "@jsonrpc-contracts-ts/size.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/size/fixtures/bootstrap.ts";
import { Persistence } from "@tests/size/integration/outbound/persistence.ts";

describe("size.list endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeAll(() => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);
  });

  afterAll(() => persistence.teardown());

  it("should return an empty list when no size has been registered", async () => {
    /* @Given no size has been registered */
    /* @When the client requests the size listing */
    const response = await rpc.invoke<SizeListResponse>("size.list", {
      sessionId: STUB_SESSION_ID,
    });

    /* @Then the response carries an empty list */
    assertEquals(response, []);
  });

  it("should return every persisted size", async () => {
    /* @Given sizes are persisted */
    await rpc.invoke<SizeRegisterResponse>("size.register", {
      sessionId: STUB_SESSION_ID,
      name: "small-vm",
      provider: "proxmox",
      cpu: 2,
      ram: 2048,
      disk: 20,
      user: "alice",
      hostname: "homelab",
    });
    await rpc.invoke<SizeRegisterResponse>("size.register", {
      sessionId: STUB_SESSION_ID,
      name: "large-vm",
      provider: "proxmox",
      cpu: 8,
      ram: 16384,
      disk: 100,
      user: "alice",
      hostname: "homelab",
    });

    /* @When the client requests the size listing */
    const response = await rpc.invoke<SizeListResponse>("size.list", {
      sessionId: STUB_SESSION_ID,
    });

    /* @Then the response carries every persisted size */
    const names = response.map((d) => d.name).sort();
    assertEquals(names, ["large-vm", "small-vm"]);
    const large = response.find((d) => d.name === "large-vm")!;
    assertEquals(large.provider, "proxmox");
    assertEquals(large.cpu, 8);
    assertEquals(large.ram, 16384);
    assertEquals(large.disk, 100);
    assertEquals(large.version, 1);
  });
});
