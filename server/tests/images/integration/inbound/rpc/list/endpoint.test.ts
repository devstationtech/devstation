import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type { ImageListResponse, ImageRegisterResponse } from "@jsonrpc-contracts-ts/image.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/images/fixtures/bootstrap.ts";
import { Persistence } from "@tests/images/integration/outbound/persistence.ts";

describe("image.list endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeAll(() => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);
  });

  afterAll(() => persistence.teardown());

  it("returns an empty list when the catalog is empty", async () => {
    const response = await rpc.invoke<ImageListResponse>("image.list", {
      sessionId: STUB_SESSION_ID,
    });
    assertEquals(response, []);
  });

  it("returns every registered image with an (empty) usages list", async () => {
    await rpc.invoke<ImageRegisterResponse>("image.register", {
      sessionId: STUB_SESSION_ID,
      name: "ubuntu-2204",
      os: "ubuntu-22-04",
      sourceUrl: "https://x/a.img",
      user: "alice",
      hostname: "homelab",
    });
    const response = await rpc.invoke<ImageListResponse>("image.list", {
      sessionId: STUB_SESSION_ID,
    });
    assertEquals(response.length, 1);
    assertEquals(response[0].name, "ubuntu-2204");
    assertEquals(response[0].usages, []);
  });
});
