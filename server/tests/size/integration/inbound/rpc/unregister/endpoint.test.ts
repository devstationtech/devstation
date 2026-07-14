import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  SizeRegisterResponse,
  SizeUnregisterResponse,
} from "@jsonrpc-contracts-ts/size.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/size/fixtures/bootstrap.ts";
import { Persistence } from "@tests/size/integration/outbound/persistence.ts";

describe("size.unregister endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeAll(() => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);
  });

  afterAll(() => persistence.teardown());

  it("should remove an existing size from the catalog", async () => {
    /* @Given a persisted size */
    await rpc.invoke<SizeRegisterResponse>("size.register", {
      sessionId: STUB_SESSION_ID,
      name: "to-remove",
      provider: "proxmox",
      cpu: 1,
      ram: 1024,
      disk: 10,
      user: "alice",
      hostname: "homelab",
    });
    const before = await persistence.readSizes();
    const target = before.find((d) => d.name === "to-remove")!;

    /* @When the client requests removal by size id */
    await rpc.invoke<SizeUnregisterResponse>("size.unregister", {
      sessionId: STUB_SESSION_ID,
      sizeId: target.id,
    });

    /* @Then the size is no longer present in the catalog */
    const after = await persistence.readSizes();
    assertEquals(after.find((d) => d.name === "to-remove"), undefined);
  });

  it("should reject removal when the size id is unknown", async () => {
    /* @Given a nonexistent size identifier */
    /* @When the client requests removal */
    /* @Then the server replies with a failure signalling the size was not found */
    await assertRejects(
      () =>
        rpc.invoke<SizeUnregisterResponse>("size.unregister", {
          sessionId: STUB_SESSION_ID,
          sizeId: "ghost-size",
        }),
      Exception,
      "not found",
    );
  });
});
