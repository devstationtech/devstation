import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { AuthenticateHandler } from "@server/auth/application/handlers/authenticate-handler.ts";
import { Authenticate } from "@server/auth/application/commands/authenticate.ts";
import { AuthenticationFailed } from "@server/auth/domain/exceptions/authentication-failed.ts";
import { Key } from "@server/auth/domain/models/key.ts";
import type { Session } from "@server/auth/domain/models/session.ts";
import type { Password } from "@server/auth/domain/models/password.ts";
import type { Auth } from "@server/auth/domain/ports/outbound/auth.ts";
import type { Sessions } from "@server/auth/domain/ports/outbound/sessions.ts";

/**
 * AuthenticateHandler is the entry point for "log me in": validates
 * the password via the Auth port, opens a Session, persists it. Two
 * branches matter:
 *  - happy path: key returned → session opened + saved + returned;
 *  - wrong password (Auth returns null) → AuthenticationFailed.
 *
 * Domain only; no integration with the wire.
 */

function fakeAuth(opts: { acceptPassword?: string; key?: string } = {}): Auth {
  const acceptPassword = opts.acceptPassword ?? "correct-pw";
  const key = opts.key ?? "deadbeef".repeat(8);
  return {
    isConfigured: () => Promise.resolve(true),
    configure: () => Promise.resolve(new Key(key)),
    authenticate: (password: Password) =>
      Promise.resolve(password.value === acceptPassword ? new Key(key) : null),
  };
}

function trackingSessions(): { sessions: Sessions; saved: Session[] } {
  const saved: Session[] = [];
  return {
    saved,
    sessions: {
      save: (s: Session) => {
        saved.push(s);
      },
      get: () => {
        throw new Error("not used by AuthenticateHandler");
      },
      active: () => {
        throw new Error("not used by AuthenticateHandler");
      },
    },
  };
}

describe("AuthenticateHandler — successful login", () => {
  it("opens and saves a Session when the password is accepted", async () => {
    /* @Given an Auth that accepts 'correct-pw' and returns a key */
    const { sessions, saved } = trackingSessions();
    const handler = new AuthenticateHandler(fakeAuth({ acceptPassword: "correct-pw" }), sessions);

    /* @When handle is called with the correct password */
    const session = await handler.handle(new Authenticate("correct-pw"));

    /* @Then a Session is opened, persisted via Sessions.save, and returned */
    assertEquals(saved.length, 1);
    assertEquals(saved[0], session);
  });

  it("returns the SAME session instance it persists (no copy)", async () => {
    /* @Given a happy-path setup */
    const { sessions, saved } = trackingSessions();
    const handler = new AuthenticateHandler(fakeAuth(), sessions);
    /* @When handle is called */
    const returned = await handler.handle(new Authenticate("correct-pw"));
    /* @Then the saved instance and the returned instance are identity-equal */
    assertEquals(returned === saved[0], true);
  });
});

describe("AuthenticateHandler — failed login", () => {
  it("throws AuthenticationFailed when the password is rejected (Auth returns null)", async () => {
    /* @Given an Auth that rejects every password */
    const { sessions, saved } = trackingSessions();
    const handler = new AuthenticateHandler(fakeAuth({ acceptPassword: "right" }), sessions);

    /* @When handle is called with a wrong-but-VO-valid password */
    /* @Then AuthenticationFailed is raised (the Auth port rejection bubbles up) */
    await assertRejects(
      () => handler.handle(new Authenticate("wrongbutlongenough123")),
      AuthenticationFailed,
    );
    /* @And NO session is persisted (a failed login must not leave a session) */
    assertEquals(saved.length, 0);
  });
});
