import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ImageListResponse,
  ImageRegisterResponse,
  ImageUpdateResponse,
} from "@jsonrpc-contracts-ts/image.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/images/fixtures/bootstrap.ts";
import { Persistence } from "@tests/images/integration/outbound/persistence.ts";

describe("image.update endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeAll(() => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);
  });

  afterAll(() => persistence.teardown());

  it("updates an existing image's os + source", async () => {
    /* @Given a registered image */
    await rpc.invoke<ImageRegisterResponse>("image.register", {
      sessionId: STUB_SESSION_ID,
      name: "ubuntu-2204",
      os: "ubuntu-22-04",
      sourceUrl: "https://x/old.img",
      user: "alice",
      hostname: "homelab",
    });
    const id =
      (await rpc.invoke<ImageListResponse>("image.list", { sessionId: STUB_SESSION_ID }))[0]
        .id;

    /* @When it is updated */
    await rpc.invoke<ImageUpdateResponse>("image.update", {
      sessionId: STUB_SESSION_ID,
      id,
      name: "ubuntu-2204",
      os: "debian-12",
      sourceUrl: "https://x/new.img",
    });

    /* @Then the change is persisted */
    const records = await persistence.readImages();
    assertEquals(records.length, 1);
    assertEquals(records[0].os, "debian-12");
    assertEquals(records[0].sourceUrl, "https://x/new.img");
  });
});
