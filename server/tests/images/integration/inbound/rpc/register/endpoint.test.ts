import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type { ImageRegisterResponse } from "@jsonrpc-contracts-ts/image.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/images/fixtures/bootstrap.ts";
import { Persistence } from "@tests/images/integration/outbound/persistence.ts";

describe("image.register endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeAll(() => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);
  });

  afterAll(() => persistence.teardown());

  it("registers a new catalog image and persists it", async () => {
    await rpc.invoke<ImageRegisterResponse>("image.register", {
      sessionId: STUB_SESSION_ID,
      name: "ubuntu-2204",
      os: "ubuntu-22-04",
      sourceUrl: "https://cloud-images.example/22.04.img",
      user: "alice",
      hostname: "homelab",
    });

    const records = await persistence.readImages();
    assertEquals(records.length, 1);
    assertEquals(records[0].name, "ubuntu-2204");
    assertEquals(records[0].os, "ubuntu-22-04");
    assertEquals(records[0].sourceUrl, "https://cloud-images.example/22.04.img");
    assertEquals(records[0].version, 1);
    assertEquals(records[0].creation.by, "alice");
  });

  it("rejects a duplicate name", async () => {
    await rpc.invoke<ImageRegisterResponse>("image.register", {
      sessionId: STUB_SESSION_ID,
      name: "debian-12",
      os: "debian-12",
      sourceUrl: "https://cloud-images.example/bookworm.img",
      user: "alice",
      hostname: "homelab",
    });
    await assertRejects(
      () =>
        rpc.invoke<ImageRegisterResponse>("image.register", {
          sessionId: STUB_SESSION_ID,
          name: "debian-12",
          os: "debian-12",
          sourceUrl: "https://cloud-images.example/bookworm.img",
          user: "alice",
          hostname: "homelab",
        }),
      Exception,
      "already exists",
    );
  });

  it("rejects an unsupported operating system", async () => {
    await assertRejects(
      () =>
        rpc.invoke<ImageRegisterResponse>("image.register", {
          sessionId: STUB_SESSION_ID,
          name: "weird",
          os: "windows-11",
          sourceUrl: "https://x/win.img",
          user: "alice",
          hostname: "homelab",
        }),
      Exception,
      "operating system",
    );
  });
});
