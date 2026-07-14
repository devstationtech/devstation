import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ImageListResponse,
  ImageRegisterResponse,
  ImageUnregisterResponse,
} from "@jsonrpc-contracts-ts/image.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/images/fixtures/bootstrap.ts";
import { Persistence } from "@tests/images/integration/outbound/persistence.ts";

describe("image.unregister endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeAll(() => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);
  });

  afterAll(() => persistence.teardown());

  it("unregisters an image from the catalog", async () => {
    /* @Given a registered image */
    await rpc.invoke<ImageRegisterResponse>("image.register", {
      sessionId: STUB_SESSION_ID,
      name: "ubuntu-2204",
      os: "ubuntu-22-04",
      sourceUrl: "https://x/a.img",
      user: "alice",
      hostname: "homelab",
    });
    const id =
      (await rpc.invoke<ImageListResponse>("image.list", { sessionId: STUB_SESSION_ID }))[0]
        .id;

    /* @When it is removed */
    await rpc.invoke<ImageUnregisterResponse>("image.unregister", {
      sessionId: STUB_SESSION_ID,
      id,
    });

    /* @Then the catalog is empty */
    assertEquals(await persistence.readImages(), []);
  });

  it("rejects removing a non-existent image", async () => {
    await assertRejects(
      () =>
        rpc.invoke<ImageUnregisterResponse>("image.unregister", {
          sessionId: STUB_SESSION_ID,
          id: "00000000-0000-0000-0000-0000000000ff",
        }),
      Exception,
      "not found",
    );
  });
});
