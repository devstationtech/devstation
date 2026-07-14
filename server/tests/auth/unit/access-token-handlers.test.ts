import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { GenerateAccessTokenHandler } from "@server/auth/application/handlers/generate-access-token-handler.ts";
import { GenerateAccessToken } from "@server/auth/application/commands/generate-access-token.ts";
import { RevokeAccessTokenHandler } from "@server/auth/application/handlers/revoke-access-token-handler.ts";
import { LoadAccessTokenHandler } from "@server/auth/application/handlers/load-access-token-handler.ts";
import { AccessToken } from "@server/auth/domain/models/access-token/access-token.ts";
import { Scope } from "@server/auth/domain/models/access-token/scope.ts";
import { WrappedKey } from "@server/auth/domain/models/access-token/wrapped-key.ts";
import { Session } from "@server/auth/domain/models/session.ts";
import { Key } from "@server/auth/domain/models/key.ts";
import type { Sessions } from "@server/auth/domain/ports/outbound/sessions.ts";
import type { KeyWrap } from "@server/auth/domain/ports/outbound/key-wrap.ts";
import type { TokenStore } from "@server/auth/domain/ports/outbound/token-store.ts";

/**
 * Access-token use cases — `GenerateAccessTokenHandler` (mint from an
 * authenticated session), `RevokeAccessTokenHandler`, and the
 * `LoadAccessTokenHandler`. Tested with in-memory fakes.
 */

// deno-lint-ignore no-explicit-any
type Anyish = any;

const WRAPPED = new WrappedKey("aa:bb", "cc", "dd");

/** Sessions fake — `get` returns the session for a known id, else throws. */
function fakeSessions(known: Record<string, Session>): Sessions {
  return {
    save: () => {},
    get: (id: string) => {
      const s = known[id];
      if (!s) throw new Error("Unauthenticated");
      return s;
    },
    active: () => {
      throw new Error("not used");
    },
  };
}

/** KeyWrap fake — records the key it was asked to wrap. */
function fakeKeyWrap(): { keyWrap: KeyWrap; wrapped: Key[] } {
  const wrapped: Key[] = [];
  const keyWrap: KeyWrap = {
    wrap: (key: Key) => {
      wrapped.push(key);
      return Promise.resolve(WRAPPED);
    },
    unwrap: () => Promise.reject(new Error("not used")),
  };
  return { keyWrap, wrapped };
}

/** In-memory TokenStore fake. */
function fakeStore(initial: AccessToken | null = null): {
  store: TokenStore;
  saved: AccessToken[];
  removed: number;
} {
  let current = initial;
  const saved: AccessToken[] = [];
  let removed = 0;
  const store: TokenStore = {
    save: (t) => {
      saved.push(t);
      current = t;
      return Promise.resolve();
    },
    load: () => Promise.resolve(current),
    remove: () => {
      removed++;
      current = null;
      return Promise.resolve();
    },
  };
  return {
    store,
    saved,
    get removed() {
      return removed;
    },
  } as Anyish;
}

describe("GenerateAccessTokenHandler", () => {
  it("mints a token from the session's vault key and stores it", async () => {
    /* @Given an authenticated session "s1" carrying a vault key */
    const session = Session.open(new Key("f".repeat(64)));
    const sessions = fakeSessions({ s1: session });
    const { keyWrap, wrapped } = fakeKeyWrap();
    const { store, saved } = fakeStore();
    const handler = new GenerateAccessTokenHandler(sessions, keyWrap, store);

    /* @When a token is generated for scopes [clusters:read, plan] */
    const token = await handler.handle(
      new GenerateAccessToken("s1", ["clusters:read", "clusters:provision:plan"], "mcp", 30),
    );

    /* @Then the session key was wrapped, and the token was stored */
    assertEquals(wrapped.length, 1);
    assertEquals(wrapped[0].value, session.key.value);
    assertEquals(saved.length, 1);
    /* @And the token carries the requested scopes + a 30-day expiry */
    assertEquals(token.scopes.map((s) => s.value), [
      "clusters:read",
      "clusters:provision:plan",
    ]);
    assertEquals(token.purpose, "mcp");
    assertEquals(token.expiresAt !== null, true);
    assertEquals(token.grants(new Scope("clusters:provision:plan")), true);
  });

  it("refuses to mint when the session is missing/expired", async () => {
    /* @Given no session "ghost" */
    const handler = new GenerateAccessTokenHandler(
      fakeSessions({}),
      fakeKeyWrap().keyWrap,
      fakeStore().store,
    );
    /* @Then generating against it throws — a token needs a live session */
    await assertRejects(
      () => handler.handle(new GenerateAccessToken("ghost", ["clusters:read"], "mcp")),
      Error,
      "Unauthenticated",
    );
  });

  it("an omitted ttl applies the default lifetime instead of never-expiring", async () => {
    /* @Given a mint request with no explicit ttl */
    const sessions = fakeSessions({ s1: Session.open(new Key("f".repeat(64))) });
    const handler = new GenerateAccessTokenHandler(
      sessions,
      fakeKeyWrap().keyWrap,
      fakeStore().store,
    );
    const before = Date.now();
    const token = await handler.handle(
      new GenerateAccessToken("s1", ["clusters:read"], "mcp"),
    );
    /* @Then the token is bounded — a vault-key-bearing token is never eternal by default */
    assertEquals(token.expiresAt !== null, true);
    const days = (token.expiresAt!.date.getTime() - before) / 86_400_000;
    const expected = GenerateAccessToken.DEFAULT_TTL_DAYS;
    assertEquals(days > expected - 0.1 && days < expected + 0.1, true);
  });

  it("a null ttl is normalised to the default lifetime (no wire path to never-expires)", async () => {
    const sessions = fakeSessions({ s1: Session.open(new Key("f".repeat(64))) });
    const handler = new GenerateAccessTokenHandler(
      sessions,
      fakeKeyWrap().keyWrap,
      fakeStore().store,
    );
    const token = await handler.handle(
      new GenerateAccessToken("s1", ["clusters:read"], "mcp", null),
    );
    assertEquals(token.expiresAt !== null, true);
  });
});

describe("RevokeAccessTokenHandler", () => {
  it("removes the stored token", async () => {
    const fake = fakeStore(
      AccessToken.issue({
        purpose: "mcp",
        scopes: [new Scope("clusters:read")],
        wrappedKey: WRAPPED,
      }),
    );
    await new RevokeAccessTokenHandler(fake.store).handle();
    assertEquals(fake.removed, 1);
    assertEquals(await fake.store.load(), null);
  });
});

describe("LoadAccessTokenHandler", () => {
  it("returns the stored token when present and not expired", async () => {
    const token = AccessToken.issue({
      purpose: "mcp",
      scopes: [new Scope("clusters:read")],
      wrappedKey: WRAPPED,
      ttlDays: 10,
    });
    const loaded = await new LoadAccessTokenHandler(fakeStore(token).store).handle();
    assertEquals(loaded?.id.value, token.id.value);
  });

  it("returns null when no token is stored", async () => {
    assertEquals(await new LoadAccessTokenHandler(fakeStore(null).store).handle(), null);
  });

  it("returns null when the stored token is expired (treated as no token)", async () => {
    /* @Given a stored token whose expiry is already past */
    const expired = AccessToken.issue({
      purpose: "mcp",
      scopes: [new Scope("clusters:read")],
      wrappedKey: WRAPPED,
      ttlDays: -1,
    });
    /* @Then the handler yields null */
    assertEquals(await new LoadAccessTokenHandler(fakeStore(expired).store).handle(), null);
  });
});
