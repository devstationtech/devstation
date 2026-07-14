import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Scope } from "@server/auth/domain/models/access-token/scope.ts";
import { WrappedKey } from "@server/auth/domain/models/access-token/wrapped-key.ts";
import { AccessToken } from "@server/auth/domain/models/access-token/access-token.ts";

/**
 * Access-token domain — `Scope` (the capability VO), `WrappedKey`
 * (the sealed-vault-key envelope) and `AccessToken` itself (issue,
 * expiry, scope grants).
 */

const aWrappedKey = () => new WrappedKey("aa:bb", "cc", "dd");

describe("Scope", () => {
  it("accepts context:action and context:group:action shapes", () => {
    for (const v of ["clusters:read", "stations:write", "clusters:provision:apply"]) {
      assertEquals(new Scope(v).value, v);
    }
  });

  it("rejects an empty value", () => {
    assertThrows(() => new Scope(""), Error, "required");
  });

  it("rejects malformed shapes (uppercase, one segment, four segments, symbols)", () => {
    for (const v of ["Clusters:read", "clusters", "a:b:c:d", "clusters:read!", "clusters: read"]) {
      assertThrows(() => new Scope(v), Error, "context:action");
    }
  });

  it("equals compares by value", () => {
    assertEquals(new Scope("clusters:read").equals(new Scope("clusters:read")), true);
    assertEquals(new Scope("clusters:read").equals(new Scope("clusters:write")), false);
  });
});

describe("WrappedKey", () => {
  it("accepts an iv:ciphertext envelope with salt and secret", () => {
    const wk = new WrappedKey("0011:22aa", "5566", "99ff");
    assertEquals([wk.wrapped, wk.salt, wk.secret], ["0011:22aa", "5566", "99ff"]);
  });

  it("allows an absent secret (secretless / hardened mode)", () => {
    assertEquals(new WrappedKey("0011:22aa", "5566").secret, undefined);
  });

  it("rejects a wrapped value without the iv:ciphertext separator", () => {
    assertThrows(() => new WrappedKey("nocolon", "5566"), Error, "iv:ciphertext");
  });

  it("rejects an empty salt", () => {
    assertThrows(() => new WrappedKey("aa:bb", ""), Error, "salt is required");
  });
});

describe("AccessToken", () => {
  it("issue with ttlDays sets an expiry that many days out", () => {
    /* @Given a 7-day token minted now */
    const before = Date.now();
    const token = AccessToken.issue({
      purpose: "mcp",
      scopes: [new Scope("clusters:read")],
      wrappedKey: aWrappedKey(),
      ttlDays: 7,
    });
    /* @Then expiresAt is ~7 days ahead, and it is not expired yet */
    const delta = token.expiresAt!.date.getTime() - before;
    assertEquals(delta > 6.9 * 86_400_000 && delta < 7.1 * 86_400_000, true);
    assertEquals(token.isExpired(), false);
  });

  it("issue without ttlDays never expires", () => {
    const token = AccessToken.issue({
      purpose: "mcp",
      scopes: [new Scope("clusters:read")],
      wrappedKey: aWrappedKey(),
    });
    assertEquals(token.expiresAt, null);
    assertEquals(token.isExpired(), false);
  });

  it("isExpired is true once expiresAt is in the past", () => {
    /* @Given a token minted with a negative ttl (already past) */
    const token = AccessToken.issue({
      purpose: "mcp",
      scopes: [new Scope("clusters:read")],
      wrappedKey: aWrappedKey(),
      ttlDays: -1,
    });
    assertEquals(token.isExpired(), true);
  });

  it("grants reflects exactly the scopes it carries", () => {
    /* @Given a token scoped to read + plan */
    const token = AccessToken.issue({
      purpose: "mcp",
      scopes: [new Scope("clusters:read"), new Scope("clusters:provision:plan")],
      wrappedKey: aWrappedKey(),
    });
    /* @Then grants is true for those, false for anything else */
    assertEquals(token.grants(new Scope("clusters:read")), true);
    assertEquals(token.grants(new Scope("clusters:provision:plan")), true);
    assertEquals(token.grants(new Scope("clusters:provision:apply")), false);
    assertEquals(token.grants(new Scope("stations:write")), false);
  });

  it("rejects an empty purpose", () => {
    assertThrows(
      () => AccessToken.issue({ purpose: "", scopes: [], wrappedKey: aWrappedKey() }),
      Error,
      "purpose is required",
    );
  });
});
