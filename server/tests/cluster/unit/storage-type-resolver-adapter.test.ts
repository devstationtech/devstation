import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { StorageTypeResolverAdapter } from "@server/cluster/outbound/executions/proxmox/storage-type-resolver-adapter.ts";
import { Connection } from "@server/cluster/domain/models/proxmox/connection/connection.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import type { ProxmoxReadApiFactory } from "@server/cluster/application/queries/proxmox/api/factory.ts";
import type { ProxmoxReadApi } from "@server/cluster/application/queries/proxmox/api/proxmox-read-api.ts";

const connection = () =>
  new Connection(
    new Hostname("10.0.0.5"),
    new Vault("00000000-0000-0000-0000-000000000010"),
    new Secret("00000000-0000-0000-0000-000000000011"),
  );

// deno-lint-ignore no-explicit-any
const apiWith = (storages: { id: string; type: string }[]): ProxmoxReadApi =>
  ({
    storages: () => Promise.resolve(storages.map((s) => ({ ...s, available: 0, total: 0 }))),
  }) as any;

const factory = (api: ProxmoxReadApi | null, throws = false): ProxmoxReadApiFactory => ({
  create: () => throws ? Promise.reject(new Error("boom")) : Promise.resolve(api),
});

describe("StorageTypeResolverAdapter", () => {
  it("maps datastore id → type from the read API", async () => {
    /* @Given a read API reporting two datastores with their types */
    const r = new StorageTypeResolverAdapter(
      factory(apiWith([{ id: "local-zfs", type: "zfspool" }, { id: "vmdir", type: "dir" }])),
    );
    /* @When the adapter resolves the node's storage */
    const map = await r.resolve(connection(), "cp4");
    /* @Then each id maps to its type and unknown ids are undefined */
    assertEquals(map.get("local-zfs"), "zfspool");
    assertEquals(map.get("vmdir"), "dir");
    assertEquals(map.get("absent"), undefined);
  });

  it("degrades to empty map when the api cannot be created", async () => {
    /* @Given the read API cannot be created */
    const r = new StorageTypeResolverAdapter(factory(null));
    /* @Then it degrades to an empty map */
    assertEquals((await r.resolve(connection(), "cp4")).size, 0);
  });

  it("degrades to empty map on factory/api error", async () => {
    /* @Given the factory throws while creating the API */
    const r = new StorageTypeResolverAdapter(factory(null, true));
    /* @Then it degrades to an empty map */
    assertEquals((await r.resolve(connection(), "cp4")).size, 0);
  });
});
