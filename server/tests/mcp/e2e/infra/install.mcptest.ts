/**
 * SIDE-EFFECT — install a station's services onto a provisioned host (runs
 * the real install pipeline; opt-in). Only a policy-permitted (ds-e2e-)
 * station with services can be installed; skips otherwise — a full install
 * also needs a provisioned host set up out of band.
 *
 * Endpoints: station_install, execution_watch. Gated by
 * DEVSTATION_E2E_DESTRUCTIVE=1.
 */
import { describe, it } from "@std/testing/bdd";
import { assert } from "@std/assert";
import { mcp } from "../harness.ts";
import { E2E_PREFIX } from "../fixtures.ts";
import type { McpClient } from "@mcp-test-harness-ts/mod.ts";

const DESTRUCTIVE = Deno.env.get("DEVSTATION_E2E_DESTRUCTIVE") === "1";

interface Started {
  readonly executionId: string;
}

/** Watches an execution to its terminal and asserts it Succeeded. */
async function watchSucceeds(client: () => McpClient, executionId: string) {
  const r = await client().parsed<{ events?: { kind?: string; type?: string }[] }>(
    "devstation_execution_watch",
    { executionId },
  );
  const terminal = (r.events ?? []).at(-1);
  const kind = terminal?.kind ?? terminal?.type ?? "";
  assert(/succeed/i.test(kind), `expected a Succeeded terminal, got '${kind}'`);
}

describe("Service install", () => {
  const client = mcp();

  if (DESTRUCTIVE) {
    it("installs an e2e station's services and watches to Succeeded", async () => {
      /* @Given an e2e-prefixed station that has installable services */
      const stations = (await client().parsed<{ id: string; name?: string }[]>(
        "devstation_station_list",
        {},
      )).filter((s) => (s.name ?? "").startsWith(E2E_PREFIX));

      let target: { stationId: string; serviceIds: string[] } | undefined;
      for (const s of stations) {
        const services = await client().parsed<{ id: string }[]>(
          "devstation_station_services_by_station",
          { stationId: s.id },
        );
        if (services.length) {
          target = { stationId: s.id, serviceIds: services.map((sv) => sv.id) };
          break;
        }
      }
      if (!target) return; // no ds-e2e- station with installable services + a provisioned host

      /* @When the station's services are installed */
      const started = await client().parsed<Started>("devstation_station_install", target);

      /* @Then the install execution watches to a Succeeded terminal */
      if (started?.executionId) await watchSucceeds(client, started.executionId);
    });
  } else {
    it.ignore("station_install (set DEVSTATION_E2E_DESTRUCTIVE=1)", () => {});
  }
});
