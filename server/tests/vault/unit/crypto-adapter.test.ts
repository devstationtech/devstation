import { assertEquals, assertNotEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { CryptoAdapter } from "@server/vault/outbound/crypto/adapter.ts";
import { Encrypted } from "@server/vault/domain/models/secret/encrypted.ts";
import { Value } from "@server/vault/domain/models/secret/value.ts";
import { Key } from "@server/vault/domain/models/key.ts";

/**
 * CryptoAdapter is the AES-GCM façade backing every secret. The
 * encryption format on disk is `<iv-hex>:<ciphertext-hex>` and the
 * adapter handles raw-key import + IV generation. Critical guarantees:
 *
 *  - encrypt(plaintext) → decrypt(...) → plaintext (round-trip).
 *  - each encrypt() produces a fresh IV, so encrypting the same value
 *    twice gives different ciphertexts (semantic security).
 *  - decrypt with the wrong key throws (tampering / wrong vault key).
 *  - the on-disk format is exactly `<hex>:<hex>` — no whitespace, no
 *    framing.
 */

/** A 256-bit AES key, hex-encoded (64 hex chars). */
function aKey(seed: number = 0xAA): Key {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (seed + i) & 0xff;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return new Key(hex);
}

describe("CryptoAdapter — round-trip", () => {
  it("encrypts then decrypts to the original plaintext (ASCII)", async () => {
    /* @Given a fresh adapter + a 256-bit key + a plaintext */
    const adapter = new CryptoAdapter();
    const key = aKey();
    const plaintext = new Value("hello world");
    /* @When encrypt → decrypt is applied */
    const encrypted = await adapter.encrypt(plaintext, key);
    const decrypted = await adapter.decrypt(encrypted, key);
    /* @Then the plaintext round-trips exactly */
    assertEquals(decrypted.value, "hello world");
  });

  it("round-trips multi-byte UTF-8 plaintext faithfully (non-ASCII chars)", async () => {
    /* @Given a plaintext with multibyte characters */
    const adapter = new CryptoAdapter();
    const key = aKey();
    const plaintext = new Value("k3s-pw-α-β-é-🔒");
    /* @When round-tripped */
    const decrypted = await adapter.decrypt(await adapter.encrypt(plaintext, key), key);
    /* @Then the bytes survive end-to-end (TextEncoder + AES-GCM + TextDecoder) */
    assertEquals(decrypted.value, "k3s-pw-α-β-é-🔒");
  });

  it("round-trips a 1-byte plaintext (smallest allowed by the Value VO)", async () => {
    /* @Given the smallest Value the domain VO accepts (empty is rejected by Value) */
    const adapter = new CryptoAdapter();
    const key = aKey();
    /* @When round-tripped */
    const decrypted = await adapter.decrypt(await adapter.encrypt(new Value("x"), key), key);
    /* @Then the single byte survives intact */
    assertEquals(decrypted.value, "x");
  });
});

describe("CryptoAdapter — semantic security", () => {
  it("two encryptions of the same plaintext produce DIFFERENT ciphertexts (fresh IV per call)", async () => {
    /* @Given the same plaintext encrypted twice with the same key */
    const adapter = new CryptoAdapter();
    const key = aKey();
    const value = new Value("same-input");
    const a = await adapter.encrypt(value, key);
    const b = await adapter.encrypt(value, key);
    /* @Then the resulting ciphertexts differ (the IV is regenerated each time) */
    assertNotEquals(a.value, b.value);
    /* @And both decrypt back to the same plaintext (proves only IV differs, not key) */
    assertEquals((await adapter.decrypt(a, key)).value, "same-input");
    assertEquals((await adapter.decrypt(b, key)).value, "same-input");
  });
});

describe("CryptoAdapter — disk format", () => {
  it("emits `<iv-hex>:<ciphertext-hex>` (lowercase hex, single colon, no whitespace)", async () => {
    /* @Given a fresh encrypt result */
    const encrypted = await new CryptoAdapter().encrypt(new Value("x"), aKey());
    /* @Then the format matches the contract */
    /*       (the persistence layer relies on the literal "<hex>:<hex>" shape) */
    const parts = encrypted.value.split(":");
    assertEquals(parts.length, 2);
    assertEquals(/^[0-9a-f]+$/.test(parts[0]), true);
    assertEquals(/^[0-9a-f]+$/.test(parts[1]), true);
    /* @And the IV is exactly 12 bytes (AES-GCM standard) → 24 hex chars */
    assertEquals(parts[0].length, 24);
  });
});

describe("CryptoAdapter — failure modes", () => {
  it("throws when decrypt is called with a different key (tamper detection)", async () => {
    /* @Given a ciphertext made with one key */
    const adapter = new CryptoAdapter();
    const encrypted = await adapter.encrypt(new Value("secret"), aKey(0xAA));
    /* @When decrypt is attempted with a different key */
    /* @Then it throws — AES-GCM's auth tag fails, never returns garbage plaintext */
    await assertRejects(() => adapter.decrypt(encrypted, aKey(0xBB)));
  });

  it("throws when the ciphertext is malformed (auth tag invalid)", async () => {
    /* @Given a corrupt ciphertext (modified by one byte) */
    const adapter = new CryptoAdapter();
    const key = aKey();
    const original = (await adapter.encrypt(new Value("secret"), key)).value;
    const [iv, ct] = original.split(":");
    const flipped = ct.slice(0, -2) + (ct.slice(-2) === "00" ? "ff" : "00");
    /* @When decrypt sees the tamper */
    /* @Then it throws — AES-GCM is authenticated, never returns garbage */
    await assertRejects(() => adapter.decrypt(new Encrypted(`${iv}:${flipped}`), key));
  });
});
