import { assertEquals, assertRejects } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Adapter } from "@server/size/outbound/persistence/file-system/adapter.ts";
import { Id } from "@server/size/domain/models/id.ts";
import { Name } from "@server/size/domain/models/name.ts";
import { ProxmoxSize } from "@server/size/domain/models/proxmox/proxmox-size.ts";
import { SizeNotFound } from "@server/size/domain/exceptions/size-not-found.ts";
import { UnsupportedProvider } from "@server/size/domain/exceptions/unsupported-provider.ts";
import { registeredProxmoxSize } from "@tests/size/fixtures/operations.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";

/**
 * Size file-system persistence Adapter — the `Sizes`
 * outbound port over `sizes.json`. Pins the CRUD contract
 * (of/add/remove/exists), the ProxmoxSize serialize ⇄
 * unserialize round-trip, and both failure modes (not-found,
 * unsupported provider on read).
 */

// deno-lint-ignore no-explicit-any
const NO_OP_LOGGER = {
  info: () => Promise.resolve(),
  error: () => Promise.resolve(),
} as any as Logger;

describe("size persistence Adapter", () => {
  let dir: string;
  let adapter: Adapter;

  beforeEach(() => {
    dir = Deno.makeTempDirSync({ prefix: "sizes-adapter-" });
    adapter = new Adapter(new FileSystem(dir), NO_OP_LOGGER);
  });

  afterEach(() => Deno.remove(dir, { recursive: true }));

  it("add then of round-trips a ProxmoxSize through serialize ⇄ unserialize", async () => {
    /* @Given a registered proxmox size */
    const def = registeredProxmoxSize("small", 4, 4096, 40);
    /* @When added and fetched by id */
    await adapter.add(def);
    const loaded = await adapter.of(def.id);
    /* @Then the deserialized aggregate is an equivalent ProxmoxSize */
    assertEquals(loaded instanceof ProxmoxSize, true);
    const proxmox = loaded as ProxmoxSize;
    assertEquals(proxmox.id.value, def.id.value);
    assertEquals(proxmox.name.value, "small");
    assertEquals(proxmox.cpu.value, 4);
    assertEquals(proxmox.ram.value, 4096);
    assertEquals(proxmox.disk.value, 40);
  });

  it("of throws SizeNotFound for an unknown id", async () => {
    await assertRejects(() => adapter.of(new Id()), SizeNotFound);
  });

  it("exists reflects whether a name is registered", async () => {
    /* @Given one size named 'small' */
    await adapter.add(registeredProxmoxSize("small"));
    /* @Then exists is true for it, false for any other name */
    assertEquals(await adapter.exists(new Name("small")), true);
    assertEquals(await adapter.exists(new Name("large")), false);
  });

  it("remove deletes the size; a subsequent of throws", async () => {
    const def = registeredProxmoxSize("small");
    await adapter.add(def);
    await adapter.remove(def.id);
    await assertRejects(() => adapter.of(def.id), SizeNotFound);
  });

  it("remove throws SizeNotFound for an unknown id", async () => {
    await assertRejects(() => adapter.remove(new Id()), SizeNotFound);
  });

  it("keeps multiple sizes independent across add/remove", async () => {
    /* @Given two sizes persisted */
    const a = registeredProxmoxSize("small", 2, 2048, 20);
    const b = registeredProxmoxSize("large", 8, 8192, 80);
    await adapter.add(a);
    await adapter.add(b);
    /* @When one is removed */
    await adapter.remove(a.id);
    /* @Then the other survives */
    assertEquals((await adapter.of(b.id)).name.value, "large");
    await assertRejects(() => adapter.of(a.id), SizeNotFound);
  });

  it("of throws UnsupportedProvider when the persisted record carries an unknown provider", async () => {
    /* @Given a sizes.json hand-written with a non-proxmox provider */
    await Deno.writeTextFile(
      join(dir, "sizes.json"),
      JSON.stringify([{
        id: "00000000-0000-0000-0000-000000000001",
        name: "aws-box",
        provider: "aws",
        version: 1,
        creation: { by: "alice", hostname: "ws", at: "2026-01-01T00:00:00.000Z" },
      }]),
    );
    /* @When the adapter unserializes it */
    /* @Then it throws UnsupportedProvider — the BC only knows Proxmox */
    await assertRejects(
      () => adapter.of(new Id("00000000-0000-0000-0000-000000000001")),
      UnsupportedProvider,
    );
  });
});
