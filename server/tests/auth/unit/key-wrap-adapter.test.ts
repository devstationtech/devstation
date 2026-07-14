import { assertEquals, assertNotEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { KeyWrapAdapter } from "@server/auth/outbound/key-wrap-adapter.ts";
import { Key } from "@server/auth/domain/models/key.ts";
import { WrappedKey } from "@server/auth/domain/models/access-token/wrapped-key.ts";

/**
 * `KeyWrapAdapter` — seals the vault key with HKDF + AES-256-GCM.
 * Pins the round-trip, the freshness of each envelope, and that the
 * envelope alone (without its secret) cannot be unwrapped.
 */

// A 32-byte vault key, hex — the shape Argon2id(outputType:"hex") yields.
const VAULT_KEY = new Key("a".repeat(64));

describe("KeyWrapAdapter", () => {
  it("wrap then unwrap round-trips the exact key", async () => {
    /* @Given the vault key */
    const adapter = new KeyWrapAdapter();
    /* @When it is wrapped and unwrapped */
    const wrapped = await adapter.wrap(VAULT_KEY);
    const back = await adapter.unwrap(wrapped);
    /* @Then the recovered key equals the original */
    assertEquals(back.value, VAULT_KEY.value);
  });

  it("produces a fresh envelope each time (random secret, salt, iv)", async () => {
    /* @Given two wraps of the same key */
    const adapter = new KeyWrapAdapter();
    const a = await adapter.wrap(VAULT_KEY);
    const b = await adapter.wrap(VAULT_KEY);
    /* @Then no envelope component is reused */
    assertNotEquals(a.secret, b.secret);
    assertNotEquals(a.salt, b.salt);
    assertNotEquals(a.wrapped, b.wrapped);
  });

  it("the envelope is an iv:ciphertext pair with a hex salt + secret", async () => {
    const wrapped = await new KeyWrapAdapter().wrap(VAULT_KEY);
    assertEquals(wrapped.wrapped.includes(":"), true);
    assertEquals(/^[0-9a-f]+$/.test(wrapped.salt), true);
    assertEquals(/^[0-9a-f]{64}$/.test(wrapped.secret ?? ""), true); // 32 bytes
  });

  it("unwrapping an envelope without its secret is refused", async () => {
    /* @Given an envelope whose secret was stripped (secretless shape) */
    const adapter = new KeyWrapAdapter();
    const wrapped = await adapter.wrap(VAULT_KEY);
    const secretless = new WrappedKey(wrapped.wrapped, wrapped.salt);
    /* @Then unwrap throws — the secretless mode is not supported yet */
    await assertRejects(() => adapter.unwrap(secretless), Error, "no secret");
  });

  it("a tampered ciphertext fails authentication (AES-GCM)", async () => {
    /* @Given a valid envelope with one ciphertext byte flipped */
    const adapter = new KeyWrapAdapter();
    const wrapped = await adapter.wrap(VAULT_KEY);
    const [iv, ct] = wrapped.wrapped.split(":");
    const flipped = ct.slice(0, -2) + (ct.endsWith("00") ? "01" : "00");
    /* @Then unwrap rejects — GCM auth tag catches the tamper */
    await assertRejects(() =>
      adapter.unwrap(new WrappedKey(`${iv}:${flipped}`, wrapped.salt, wrapped.secret))
    );
  });
});
