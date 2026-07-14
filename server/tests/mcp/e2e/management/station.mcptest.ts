/**
 * Station management e2e — every station MCP endpoint over a real server, one
 * happy path: list → register → get → update → services-by-station (empty) →
 * register a standalone service → services list/get/by-blueprint → instances
 * list → teardown. Pure catalog (no install — that lives in infra),
 * self-cleaning.
 *
 * The service is registered standalone against a blueprint that declares
 * roles (docker/k3s, host null), with one instance pinned to a dummy host + a
 * throwaway credential. Hosted blueprints (which need a pre-existing host
 * service) are skipped — that chain belongs to the install flow.
 *
 * Endpoints: station_list, _register, _get, _update, _services_by_station,
 *   _service_register, _services_list, _service_get, _services_by_blueprint,
 *   _instances_list, _service_remove, _remove.
 */
import { describe, it } from "@std/testing/bdd";
import { assert } from "@std/assert";
import { mcp } from "../harness.ts";
import { SERVICE, STATION, uniqueName } from "../fixtures.ts";

interface Ref {
  readonly id: string;
  readonly name?: string;
}
interface BlueprintRef {
  readonly id?: string;
  readonly name: string;
  readonly host: unknown;
  readonly roles?: ReadonlyArray<{ name: string }>;
}

describe("Station management", () => {
  const client = mcp();

  it("manages a station with a standalone service end to end", async () => {
    /* @Given the station list answers */
    await client().parsed<Ref[]>("devstation_station_list", {});

    /* @When a station is registered */
    const { stationId } = await client().parsed<{ stationId: string }>(
      "devstation_station_register",
      STATION,
    );

    /* @Then it can be fetched by id */
    const station = await client().parsed<Ref>("devstation_station_get", { id: stationId });
    assert(station.id === stationId, "fetched station should match the registered id");

    /* @And its name/description can be updated */
    await client().parsed("devstation_station_update", {
      stationId,
      name: STATION.name,
      description: "e2e station (updated)",
    });

    /* @And it has no services before one is registered */
    const before = await client().parsed<Ref[]>(
      "devstation_station_services_by_station",
      { stationId },
    );
    assert(before.length === 0, "a freshly registered station should have no services");

    // A standalone service needs a roles[] blueprint (host is null) + one
    // instance with a host + credential. Skip if the catalog has only hosted.
    const blueprints = await client().parsed<BlueprintRef[]>("devstation_blueprint_list", {});
    const standalone = blueprints.find((b) => !b.host && (b.roles?.length ?? 0) > 0);
    const role = standalone?.roles?.[0]?.name;

    if (standalone && role) {
      const blueprint = standalone.name;

      /* @Given a throwaway credential vault with username + password secrets */
      const { vaultId } = await client().parsed<{ vaultId: string }>(
        "devstation_vault_create",
        { name: uniqueName("svc-vault") },
      );
      const { secretId: usernameSecretId } = await client().parsed<{ secretId: string }>(
        "devstation_vault_secret_generate",
        { vaultId, name: uniqueName("svc-user") },
      );
      const { secretId: passwordSecretId } = await client().parsed<{ secretId: string }>(
        "devstation_vault_secret_generate",
        { vaultId, name: uniqueName("svc-pass") },
      );

      /* @When a standalone service is registered against the blueprint */
      await client().parsed("devstation_station_service_register", {
        stationId,
        ...SERVICE,
        blueprint,
        vaultId,
        inputs: {},
        secrets: {},
        instances: [{
          role,
          host: "10.255.0.20",
          credentialVaultId: vaultId,
          usernameSecretId,
          passwordSecretId,
        }],
      });

      /* @Then it appears in the services list (register returns no id — resolve by name) */
      const services = await client().parsed<Ref[]>("devstation_station_services_list", {});
      const serviceId = services.find((s) => s.name === SERVICE.name)?.id;
      assert(serviceId, "registered service should be listed");

      /* @And it can be fetched by id */
      const service = await client().parsed<Ref>("devstation_station_service_get", {
        id: serviceId,
      });
      assert(service.id === serviceId, "fetched service should match the registered id");

      /* @And it is listed by its blueprint */
      const byBlueprint = await client().parsed<Ref[]>(
        "devstation_station_services_by_blueprint",
        { blueprint },
      );
      assert(
        byBlueprint.some((s) => s.id === serviceId),
        "registered service should be listed by its blueprint",
      );

      /* @And the cross-station instances list answers */
      await client().parsed<Ref[]>("devstation_station_instances_list", {});

      /* @When the service and its credential vault are removed (teardown) */
      await client().parsed("devstation_station_service_unregister", { stationId, serviceId });
      await client().parsed("devstation_vault_delete", { vaultId });
    } else {
      /* No standalone blueprint (with roles) in the catalog — skip the service
       * portion; the cross-station instances list still answers. */
      await client().parsed<Ref[]>("devstation_station_instances_list", {});
    }

    /* @Then the station can be removed (teardown) */
    await client().parsed("devstation_station_unregister", { stationId });
  });
});
