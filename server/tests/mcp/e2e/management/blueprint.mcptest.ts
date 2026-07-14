/**
 * Blueprint management e2e — read-only catalog over a real server: list →
 * get(first). No infra, no mutation. Skips `get` when the catalog is empty.
 *
 * Endpoints: blueprint_list, _get.
 */
import { describe, it } from "@std/testing/bdd";
import { assert } from "@std/assert";
import { mcp } from "../harness.ts";

interface BlueprintRef {
  readonly id?: string;
  readonly name: string;
}

describe("Blueprint management", () => {
  const client = mcp();

  it("lists the blueprint catalog and fetches the first one", async () => {
    /* @Given the blueprint catalog */
    const list = await client().parsed<BlueprintRef[]>("devstation_blueprint_list", {});

    /* @When the catalog is empty, there is nothing to fetch */
    if (list.length === 0) return;

    /* @When the first blueprint is fetched by id */
    const first = list[0];
    const id = first.id ?? first.name;
    const blueprint = await client().parsed<BlueprintRef>("devstation_blueprint_get", { id });

    /* @Then it resolves to a named blueprint */
    assert(blueprint != null, "blueprint_get should resolve a blueprint");
    assert(typeof blueprint.name === "string", "fetched blueprint should carry a name");
  });
});
