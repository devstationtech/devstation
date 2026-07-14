import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ResourceRegistry } from "@server/shared/inbound/mcp/resource/resource-registry.ts";
import type { Resource } from "@server/shared/inbound/mcp/resource/resource.ts";

/**
 * Pins the ResourceRegistry shape end-to-end with synthetic resources
 * (no real BC). Covers register / list / read / unknown URI /
 * duplicate URI / async + sync `read()` callsites.
 */

const syntheticClusters: Resource = {
  uri: "test://clusters",
  name: "clusters",
  description: "Synthetic clusters",
  read: () => [{ id: "c1", name: "homelab" }],
};

const syntheticAsync: Resource = {
  uri: "test://services",
  name: "services",
  description: "Synthetic async services",
  read: () => Promise.resolve([{ id: "s1" }, { id: "s2" }]),
};

describe("ResourceRegistry", () => {
  it("registers + lists resources with uri/name/description", () => {
    /* @Given a registry with two synthetic resources registered */
    const r = ResourceRegistry.empty().register(syntheticClusters).register(syntheticAsync);
    /* @Then list() returns their uri/name/description */
    assertEquals(r.list(), [
      { uri: "test://clusters", name: "clusters", description: "Synthetic clusters" },
      { uri: "test://services", name: "services", description: "Synthetic async services" },
    ]);
  });

  it("read wraps the resource value in the wire envelope (mimeType + stringified text)", async () => {
    /* @Given a registry holding a sync resource */
    const r = ResourceRegistry.empty().register(syntheticClusters);
    /* @When its URI is read */
    const res = await r.read("test://clusters");
    /* @Then the value is wrapped in the wire envelope (uri + mimeType + stringified text) */
    assertEquals(res.contents[0].uri, "test://clusters");
    assertEquals(res.contents[0].mimeType, "application/json");
    assertEquals(JSON.parse(res.contents[0].text), [{ id: "c1", name: "homelab" }]);
  });

  it("read awaits async `read()` (used by query-backed resources)", async () => {
    /* @Given a registry holding an async resource */
    const r = ResourceRegistry.empty().register(syntheticAsync);
    /* @When its URI is read */
    const res = await r.read("test://services");
    /* @Then the awaited value is serialized into the envelope */
    assertEquals(JSON.parse(res.contents[0].text), [{ id: "s1" }, { id: "s2" }]);
  });

  it("read throws on unknown URI (registry surfaces it; SDK becomes an error)", async () => {
    /* @Given an empty registry */
    const r = ResourceRegistry.empty();
    /* @Then reading an unknown URI rejects */
    await assertRejects(() => r.read("test://nope"), Error, "unknown resource");
  });

  it("register rejects duplicate URIs", () => {
    /* @Given a registry already holding a resource */
    const r = ResourceRegistry.empty().register(syntheticClusters);
    /* @When the same URI is registered again */
    /* @Then it throws a duplicate-resource error */
    try {
      r.register(syntheticClusters);
      throw new Error("should have thrown");
    } catch (err) {
      assertEquals(
        err instanceof Error && err.message.includes("duplicate MCP resource"),
        true,
      );
    }
  });
});
