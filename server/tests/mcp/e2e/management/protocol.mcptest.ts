/**
 * Protocol & resources e2e — cross-cutting reads over a real server: the
 * version handshake, the execution snapshot, and every exposed resource uri.
 * No infra, no mutation.
 *
 * Endpoints: rpc_version, execution_list. Resources: clusters, stations,
 *            services, blueprints, executions.
 */
import { describe, it } from "@std/testing/bdd";
import { assert } from "@std/assert";
import { mcp } from "../harness.ts";

const RESOURCE_URIS = [
  "devstation://clusters",
  "devstation://stations",
  "devstation://services",
  "devstation://blueprints",
  "devstation://executions",
] as const;

describe("Protocol & resources", () => {
  const client = mcp();

  it("answers the version handshake, reads executions, and serves every resource as JSON", async () => {
    /* @Given the version handshake answers */
    const version = await client().parsed<{ protocol?: string; core?: string }>(
      "devstation_rpc_version",
      {},
    );
    assert(version != null, "rpc_version should answer");

    /* @When the execution snapshot is read */
    const executions = await client().parsed<unknown[]>("devstation_execution_list", {});
    assert(Array.isArray(executions), "execution_list should return an array");

    /* @Then every exposed resource yields parseable JSON */
    for (const uri of RESOURCE_URIS) {
      const text = await client().readResource(uri);
      JSON.parse(text); // resource bodies are JSON — throws if not parseable
    }
  });
});
