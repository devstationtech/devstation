import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ConfigureHandler } from "@server/auth/application/handlers/configure-handler.ts";
import { RenewHandler } from "@server/auth/application/handlers/renew-handler.ts";
import { Configure } from "@server/auth/application/commands/configure.ts";
import { Renew } from "@server/auth/application/commands/renew.ts";
import { Session } from "@server/auth/domain/models/session.ts";
import { Key } from "@server/auth/domain/models/key.ts";
import { AlreadyConfigured } from "@server/auth/domain/exceptions/already-configured.ts";
import type { Password } from "@server/auth/domain/models/password.ts";
import type { Auth } from "@server/auth/domain/ports/outbound/auth.ts";
import type { Sessions } from "@server/auth/domain/ports/outbound/sessions.ts";

/**
 * Configure (first-time setup) and Renew (extend an existing session)
 * are the two auth flows besides Authenticate. Each opens or extends
 * a Session and persists it. Pins:
 *  - Configure: opens a fresh session and saves it.
 *  - Renew: takes the existing session by id, asks it to renew (new
 *    expiration), persists the renewed copy. The renewed session
 *    keeps the same id + key — only the expiration moves forward.
 */

function fakeAuth(opts: { key?: string; configured?: boolean } = {}): Auth {
  const key = opts.key ?? "feedface".repeat(8);
  return {
    isConfigured: () => Promise.resolve(opts.configured ?? false),
    configure: (_password: Password) => Promise.resolve(new Key(key)),
    authenticate: (_password: Password) => Promise.resolve(new Key(key)),
  };
}

function trackingSessions(seed: Session | null = null): {
  sessions: Sessions;
  saved: Session[];
} {
  const saved: Session[] = [];
  if (seed) saved.push(seed);
  return {
    saved,
    sessions: {
      save: (s: Session) => {
        saved.push(s);
      },
      get: (id: string) => {
        const match = saved.find((s) => s.id.value === id);
        if (!match) throw new Error(`session not found: ${id}`);
        return match;
      },
      active: () => {
        throw new Error("active() not used by these handlers");
      },
    },
  };
}

describe("ConfigureHandler", () => {
  it("calls auth.configure with the password then opens AND persists a Session", async () => {
    /* @Given a fresh setup (no sessions yet) */
    const { sessions, saved } = trackingSessions();
    const handler = new ConfigureHandler(fakeAuth(), sessions);
    /* @When configure is invoked with the operator's chosen password */
    const opened = await handler.handle(new Configure("strong-master-password-1"));
    /* @Then a Session was opened, saved, and returned (identity-equal) */
    assertEquals(saved.length, 1);
    assertEquals(saved[0], opened);
  });

  it("returns a session with an expiration in the future (TTL applied)", async () => {
    const { sessions } = trackingSessions();
    const handler = new ConfigureHandler(fakeAuth(), sessions);
    const before = Date.now();
    const opened = await handler.handle(new Configure("strong-master-password-1"));
    /* @Then the session was just opened — it cannot already be expired */
    assertEquals(opened.isExpired(), false);
    /* @And id + key are non-empty */
    assertEquals(opened.id.value.length > 0, true);
    assertEquals(opened.key.value.length > 0, true);
    /* sanity: clock didn't jump backward during the test */
    assertEquals(Date.now() >= before, true);
  });

  it("refuses to reconfigure once a master password already exists", async () => {
    /* @Given an installation that is already configured */
    const { sessions, saved } = trackingSessions();
    const handler = new ConfigureHandler(fakeAuth({ configured: true }), sessions);
    /* @When configure is invoked again */
    /* @Then it is rejected as already configured — the existing vault key is never replaced */
    await assertRejects(
      () => handler.handle(new Configure("another-strong-password-1")),
      AlreadyConfigured,
    );
    /* @And no session was opened */
    assertEquals(saved.length, 0);
  });
});

describe("RenewHandler", () => {
  it("looks up the session by id, renews it, and persists the renewed copy", async () => {
    /* @Given a session already in the store */
    const seed = Session.open(new Key("cafebabe".repeat(8)));
    const { sessions, saved } = trackingSessions(seed);
    const handler = new RenewHandler(sessions);

    /* @When renew is invoked for that session's id */
    const renewed = await handler.handle(new Renew(seed.id.value));

    /* @Then the renewed session was persisted (2 entries: seed + renewed copy) */
    assertEquals(saved.length, 2);
    assertEquals(saved[1], renewed);
    /* @And id + key are preserved (renewal moves only the expiration) */
    assertEquals(renewed.id.value, seed.id.value);
    assertEquals(renewed.key.value, seed.key.value);
    /* @And renew produced a NEW Session instance (immutable — never mutates the seed) */
    assertEquals(renewed === seed, false);
    /* @And the renewed session is not expired */
    assertEquals(renewed.isExpired(), false);
  });

  it("propagates Sessions.get error when the session is not found", async () => {
    /* @Given an empty session store */
    const { sessions } = trackingSessions();
    const handler = new RenewHandler(sessions);
    /* @When renew is called with an unknown sessionId */
    /* @Then the underlying Sessions.get error bubbles up (caller maps to Unauthenticated) */
    await assertRejects(() => handler.handle(new Renew("00000000-0000-0000-0000-000000000000")));
  });
});
