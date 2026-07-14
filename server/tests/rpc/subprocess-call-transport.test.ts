/**
 * Proves the LIBRARY transport — `SubprocessCall` from
 * `@jsonrpc-client-ts`, the exact class the TUI's RpcClientsProvider
 * constructs — drives the real `bin/devstation-server` end-to-end.
 *
 * The existing subprocess.test.ts spawns the engine with its own
 * Deno.Command harness, so it never exercises SubprocessCall itself.
 * After SubprocessCall was refactored onto an injected `Spawn`,
 * that production path had only type-checking behind it — this closes
 * the gap: spawn via the lib's `denoSpawn`, frame + correlate a real
 * `rpc.version` handshake over stdio, and exercise concurrency (the
 * write-chain serialization) against the live engine.
 */
import { assert, assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { Client, SubprocessCall } from "@jsonrpc-client-ts/mod.ts";
import { denoSpawn } from "@jsonrpc-client-ts/deno-spawn.ts";

describe("SubprocessCall transport — real engine over the library path", () => {
  let subprocess: SubprocessCall;
  let client: Client;

  beforeEach(() => {
    subprocess = new SubprocessCall(
      "deno",
      ["run", "-A", "server/bin/devstation-server"],
      denoSpawn,
    );
    client = new Client(subprocess);
  });

  afterEach(async () => {
    await subprocess.shutdown();
  });

  it("completes the rpc.version handshake (spawn → frame → correlate → reply)", async () => {
    /* @When the client invokes the unauthenticated handshake method */
    const handshake = await client.invoke<{ protocol: string; core: string }>("rpc.version", {});

    /* @Then the engine answered over the injected-spawn stdio transport */
    assertEquals(handshake.protocol, "1.0");
    assert(handshake.core.length > 0);
  });

  it("correlates many concurrent calls without frame corruption", async () => {
    /* @When 20 handshakes are issued in parallel through one channel */
    const replies = await Promise.all(
      Array.from({ length: 20 }, () => client.invoke<{ protocol: string }>("rpc.version", {})),
    );

    /* @Then every one resolved with a well-formed reply (write-chain held) */
    assertEquals(replies.length, 20);
    for (const reply of replies) assertEquals(reply.protocol, "1.0");
  });
});
