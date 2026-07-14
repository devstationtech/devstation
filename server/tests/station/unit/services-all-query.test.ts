import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import {
  buildHostMap,
  type FlatService,
  flatServicesFromStations,
  projectService,
  Query as ServicesAllQuery,
} from "@server/station/application/queries/services/all/query.ts";

/**
 * `station.services.list` query — flattens services across stations
 * and enriches each instance with provider/cluster/node from the VM
 * topology. `flatServicesFromStations`, `buildHostMap` and
 * `projectService` are pure; tests pin their branches (missing
 * `services`, host resolved vs unresolved, empty installations, hostMap
 * hit vs miss) then a tempdir round-trip for `Query.execute`.
 */

// deno-lint-ignore no-explicit-any
type Anyish = any;

describe("flatServicesFromStations", () => {
  it("flattens every station's services with the parent stationId attached", () => {
    /* @Given two stations, the first with 2 services, the second with 1 */
    const stations = [
      { id: "st1", services: [{ id: "a" }, { id: "b" }] },
      { id: "st2", services: [{ id: "c" }] },
    ] as Anyish;
    /* @When flattened */
    const flat = flatServicesFromStations(stations);
    /* @Then each service carries its origin station id */
    assertEquals(flat.map((s) => [s.id, s.stationId]), [
      ["a", "st1"],
      ["b", "st1"],
      ["c", "st2"],
    ]);
  });

  it("treats a station with no `services` field as contributing nothing", () => {
    const flat = flatServicesFromStations([{ id: "st1" }] as Anyish);
    assertEquals(flat, []);
  });

  it("normalizes legacy state written before the deploy->install rename", () => {
    /* @Given a service with the legacy `deployments` key and `DEPLOYED` status */
    const stations = [{
      id: "st1",
      services: [{
        id: "legacy",
        status: "DEPLOYED",
        instances: [],
        host: null,
        deployments: [{
          role: "main",
          host: "h",
          at: "2026-01-01T00:00:00.000Z",
          result: { blueprint: { version: "1" }, outputs: {} },
        }],
      }],
    }] as Anyish;
    /* @When flattened */
    const [s] = flatServicesFromStations(stations);
    /* @Then it reads as `installations` + `INSTALLED` (no crash downstream) */
    assertEquals(s.status, "INSTALLED");
    assertEquals(s.installations.length, 1);
    assertEquals(
      projectService(s, new Map(), new Map()).lastInstalledAt,
      "2026-01-01T00:00:00.000Z",
    );
  });
});

describe("buildHostMap", () => {
  it("indexes every VM by its address with provider/cluster/node info", () => {
    /* @Given a cluster with one node holding two VMs */
    const clusters = [{
      name: "homelab",
      provider: "proxmox",
      nodes: [{
        name: "cp4",
        virtualMachines: [
          { address: "10.0.0.1", name: "vm-a" },
          { address: "10.0.0.2", name: "vm-b" },
        ],
      }],
    }] as Anyish;
    /* @When the host map is built */
    const map = buildHostMap(clusters);
    /* @Then each VM address resolves to its enrichment record */
    assertEquals(map.get("10.0.0.1"), {
      name: "vm-a",
      provider: "proxmox",
      cluster: "homelab",
      node: "cp4",
    });
    assertEquals(map.get("10.0.0.2")?.name, "vm-b");
    assertEquals(map.has("10.0.0.9"), false);
  });

  it("is empty when no clusters/nodes/VMs exist", () => {
    assertEquals(buildHostMap([]).size, 0);
  });
});

describe("projectService", () => {
  const empty = new Map<string, FlatService>();
  const noHosts = new Map<
    string,
    { name: string; provider: string; cluster: string; node: string }
  >();

  it("lastInstalledAt is null when the service has no installations", () => {
    const s = {
      id: "s1",
      stationId: "st1",
      name: "svc",
      blueprint: "k3s",
      status: "REGISTERED",
      instances: [],
      host: null,
      installations: [],
    } as Anyish;
    const r = projectService(s, empty, noHosts);
    assertEquals(r.lastInstalledAt, null);
  });

  it("lastInstalledAt is the latest installation timestamp (lexical max of ISO strings)", () => {
    /* @Given three installations in non-sorted order */
    const s = {
      id: "s1",
      stationId: "st1",
      name: "svc",
      blueprint: "k3s",
      status: "INSTALLED",
      instances: [],
      host: null,
      installations: [
        {
          role: "main",
          host: "h",
          at: "2026-01-02T00:00:00.000Z",
          result: { blueprint: { version: "1" }, outputs: {} },
        },
        {
          role: "main",
          host: "h",
          at: "2026-03-09T00:00:00.000Z",
          result: { blueprint: { version: "3" }, outputs: {} },
        },
        {
          role: "main",
          host: "h",
          at: "2026-02-05T00:00:00.000Z",
          result: { blueprint: { version: "2" }, outputs: {} },
        },
      ],
    } as Anyish;
    /* @Then lastInstalledAt is the most recent timestamp */
    const r = projectService(s, empty, noHosts);
    assertEquals(r.lastInstalledAt, "2026-03-09T00:00:00.000Z");
    assertEquals(r.installations.map((d) => d.blueprintVersion), ["1", "3", "2"]);
  });

  it("resolves a host reference against the service map (name + blueprint)", () => {
    /* @Given a hosted service pointing at an existing host service */
    const hostSvc = {
      id: "host-1",
      name: "k3s-cluster",
      blueprint: "k3s",
    } as Anyish as FlatService;
    const byId = new Map<string, FlatService>([["host-1", hostSvc]]);
    const s = {
      id: "s2",
      stationId: "st1",
      name: "addon",
      blueprint: "addon-bp",
      status: "REGISTERED",
      instances: [],
      host: { serviceId: "host-1", role: "server" },
      installations: [],
    } as Anyish;
    /* @Then the host record carries the resolved display fields */
    const r = projectService(s, byId, noHosts);
    assertEquals(r.host, {
      serviceId: "host-1",
      serviceName: "k3s-cluster",
      serviceBlueprint: "k3s",
      role: "server",
    });
  });

  it("falls back to the raw id + empty blueprint when the host service is unresolved", () => {
    /* @Given a host reference whose service id is not in the map */
    const s = {
      id: "s3",
      stationId: "st1",
      name: "orphan-addon",
      blueprint: "addon-bp",
      status: "REGISTERED",
      instances: [],
      host: { serviceId: "ghost", role: "agent" },
      installations: [],
    } as Anyish;
    /* @Then serviceName degrades to the id, blueprint to "" — no crash */
    const r = projectService(s, empty, noHosts);
    assertEquals(r.host?.serviceName, "ghost");
    assertEquals(r.host?.serviceBlueprint, "");
  });

  it("enriches instances from the host map; unresolved hosts get empty enrichment", () => {
    /* @Given two instances — one VM is in the host map, one isn't */
    const hosts = new Map([["10.0.0.1", {
      name: "vm-a",
      provider: "proxmox",
      cluster: "homelab",
      node: "cp4",
    }]]);
    const s = {
      id: "s4",
      stationId: "st1",
      name: "svc",
      blueprint: "k3s",
      status: "INSTALLED",
      instances: [
        { role: "server", host: "10.0.0.1" },
        { role: "agent", host: "10.0.0.9" },
      ],
      host: null,
      installations: [],
    } as Anyish;
    const r = projectService(s, empty, hosts);
    /* @Then the resolved instance carries VM info; the unresolved one has empty strings */
    assertEquals(r.instances[0], {
      role: "server",
      host: "10.0.0.1",
      name: "vm-a",
      provider: "proxmox",
      cluster: "homelab",
      node: "cp4",
    });
    assertEquals(r.instances[1], {
      role: "agent",
      host: "10.0.0.9",
      name: "",
      provider: "",
      cluster: "",
      node: "",
    });
  });
});

describe("ServicesAllQuery.execute", () => {
  async function withFs<T>(
    stations: unknown,
    clusters: unknown,
    fn: (q: ServicesAllQuery) => Promise<T>,
  ): Promise<T> {
    const dir = await Deno.makeTempDir({ prefix: "services-all-query-" });
    try {
      await Deno.writeTextFile(join(dir, "stations.json"), JSON.stringify(stations));
      await Deno.writeTextFile(join(dir, "clusters.json"), JSON.stringify(clusters));
      return await fn(new ServicesAllQuery(new FileSystem(dir)));
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  }

  it("returns an empty list when no stations exist", async () => {
    const records = await withFs([], [], (q) => q.execute());
    assertEquals(records, []);
  });

  it("projects a standalone service with instance enrichment from the cluster topology", async () => {
    /* @Given a station with one standalone service whose VM is in a cluster */
    const records = await withFs(
      [{
        id: "st1",
        services: [{
          id: "svc-1",
          name: "k3s",
          blueprint: "k3s",
          status: "INSTALLED",
          instances: [{ role: "server", host: "10.0.0.1" }],
          host: null,
          installations: [],
        }],
      }],
      [{
        name: "homelab",
        provider: "proxmox",
        nodes: [{ name: "cp4", virtualMachines: [{ address: "10.0.0.1", name: "k3s-server" }] }],
      }],
      (q) => q.execute(),
    );
    /* @Then the projected service carries the enriched instance */
    assertEquals(records.length, 1);
    assertEquals(records[0].instances[0].name, "k3s-server");
    assertEquals(records[0].instances[0].cluster, "homelab");
  });
});
