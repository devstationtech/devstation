import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type { SizeRegisterResponse } from "@jsonrpc-contracts-ts/size.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/size/fixtures/bootstrap.ts";
import { Persistence } from "@tests/size/integration/outbound/persistence.ts";

describe("size.register endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeAll(() => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);
  });

  afterAll(() => persistence.teardown());

  it("should register a new size and persist it", async () => {
    /* @Given a request to register a new size */
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

    /* @Then a new size is persisted with the request data */
    const records = await persistence.readSizes();
    assertEquals(records.length, 1);
    assertEquals(records[0].name, "small-vm");
    assertEquals(records[0].provider, "proxmox");
    assertEquals(records[0].cpu, 2);
    assertEquals(records[0].ram, 2048);
    assertEquals(records[0].disk, 20);
    assertEquals(records[0].version, 1);
    assertEquals(records[0].creation.by, "alice");
  });

  it("should reject registration of a size with a duplicate name", async () => {
    /* @Given a size with the desired name already exists */
    await rpc.invoke<SizeRegisterResponse>("size.register", {
      sessionId: STUB_SESSION_ID,
      name: "medium-vm",
      provider: "proxmox",
      cpu: 4,
      ram: 4096,
      disk: 40,
      user: "alice",
      hostname: "homelab",
    });

    /* @When a second registration with the same name is requested */
    /* @Then the server replies with a failure signalling the duplicate */
    await assertRejects(
      () =>
        rpc.invoke<SizeRegisterResponse>("size.register", {
          sessionId: STUB_SESSION_ID,
          name: "medium-vm",
          provider: "proxmox",
          cpu: 4,
          ram: 4096,
          disk: 40,
          user: "alice",
          hostname: "homelab",
        }),
      Exception,
      "already exists",
    );
  });

  it("should reject registration when the provider is unsupported", async () => {
    /* @Given a request with a provider not supported by the catalog */
    /* @When the client requests the registration */
    /* @Then the server replies with a failure signalling the unsupported provider */
    await assertRejects(
      () =>
        rpc.invoke<SizeRegisterResponse>("size.register", {
          sessionId: STUB_SESSION_ID,
          name: "weird-vm",
          provider: "not-a-real-provider",
          cpu: 1,
          ram: 1024,
          disk: 10,
          user: "alice",
          hostname: "homelab",
        }),
      Exception,
      "provider",
    );
  });
});
