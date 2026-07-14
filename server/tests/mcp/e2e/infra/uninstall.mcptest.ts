/**
 * SIDE-EFFECT — full install→uninstall cycle of a station's services against a
 * provisioned host (runs the real pipelines; opt-in). Installs the services,
 * watches to Succeeded, then tears them down and watches to Succeeded. Only a
 * policy-permitted (ds-e2e-) station with services + a provisioned host is
 * exercised; skips otherwise.
 *
 * Endpoints: station_install, station_uninstall, execution_watch. Gated by
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

async function watchSucceeds(client: () => McpClient, executionId: string) {
  const r = await client().parsed<{ events?: { kind?: string; type?: string }[] }>(
    "devstation_execution_watch",
    { executionId },
  );
  const terminal = (r.events ?? []).at(-1);
  const kind = terminal?.kind ?? terminal?.type ?? "";
  assert(/succeed/i.test(kind), `expected a Succeeded terminal, got '${kind}'`);
}

describe("Service uninstall", () => {
  const client = mcp();

  if (DESTRUCTIVE) {
    it("installs then uninstalls an e2e station's services, both watch to Succeeded", async () => {
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
      if (!target) return; // no ds-e2e- station with services + a provisioned host

      /* @When the station's services are installed */
      const installed = await client().parsed<Started>("devstation_station_install", target);
      if (installed?.executionId) await watchSucceeds(client, installed.executionId);

      /* @When the same services are torn down @Then the teardown watches to Succeeded */
      const uninstalled = await client().parsed<Started>("devstation_station_uninstall", target);
      if (uninstalled?.executionId) await watchSucceeds(client, uninstalled.executionId);
    });
  } else {
    it.ignore("station_uninstall (set DEVSTATION_E2E_DESTRUCTIVE=1)", () => {});
  }
});
