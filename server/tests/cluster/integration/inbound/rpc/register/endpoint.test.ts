import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type { ClusterRegisterResponse } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

describe("cluster.register endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeAll(() => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);
  });

  afterAll(() => persistence.teardown());

  it("should register a new cluster and persist it", async () => {
    /* @Given a request to register a new cluster */
    await rpc.invoke<ClusterRegisterResponse>("cluster.register", {
      sessionId: STUB_SESSION_ID,
      name: "homelab",
      user: "alice",
      hostname: "workstation",
    });

    /* @Then a new cluster is persisted with the request data */
    const records = await persistence.readClusters();
    assertEquals(records.length, 1);
    assertEquals(records[0].name, "homelab");
    assertEquals(records[0].creation.by, "alice");
    assertEquals(records[0].creation.hostname, "workstation");
    assertEquals(records[0].version, 1);
  });

  it("should reject registration of a cluster with a duplicate name", async () => {
    /* @Given a cluster with the desired name already exists (from previous test) */
    /* @When a second registration with the same name is requested */
    /* @Then the server replies with a failure signalling the duplicate */
    await assertRejects(
      () =>
        rpc.invoke<ClusterRegisterResponse>("cluster.register", {
          sessionId: STUB_SESSION_ID,
          name: "homelab",
          user: "alice",
          hostname: "workstation",
        }),
      Exception,
      "already exists",
    );
  });
});
