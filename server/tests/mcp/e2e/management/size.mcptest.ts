/**
 * Size management e2e — every size MCP endpoint over a real
 * server, one happy path: register → list → unregister. Pure catalog
 * (no infra), self-cleaning.
 *
 * Endpoints: size_register, _list, _unregister.
 */
import { describe, it } from "@std/testing/bdd";
import { assert } from "@std/assert";
import { mcp } from "../harness.ts";
import { SIZE } from "../fixtures.ts";

describe("Size management", () => {
  const client = mcp();

  it("registers a VM hardware size, finds it in the list, and cleans up", async () => {
    /* @Given a registered VM hardware size */
    const { sizeId } = await client().parsed<{ sizeId: string }>(
      "devstation_size_register",
      SIZE,
    );

    /* @Then it appears in the size list */
    const defs = await client().parsed<{ id: string; name: string }[]>(
      "devstation_size_list",
      {},
    );
    assert(
      defs.some((d) => d.id === sizeId || d.name === SIZE.name),
      "registered size should be listed",
    );

    /* @When the size is unregistered */
    await client().parsed("devstation_size_unregister", { sizeId });

    /* @Then it is gone from the list */
    const remaining = await client().parsed<{ id: string }[]>("devstation_size_list", {});
    assert(!remaining.some((d) => d.id === sizeId), "unregistered size should be gone");
  });
});
