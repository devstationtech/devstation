/// <reference types="@types/react" />
import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { SessionExpiryClient } from "@ui/shared/session-expiry-client.ts";
import { SESSION_EXPIRED, sessionExpired } from "@ui/shared/session-expired.ts";
import type { Channel } from "@jsonrpc-client-ts/channel.ts";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import { ErrorCode } from "@jsonrpc-client-ts/error/error-code.ts";

/**
 * SessionExpiryClient is the UI's single chokepoint for session
 * lifecycle: when ANY RPC call fails with Unauthenticated, it emits
 * the global SESSION_EXPIRED event so AuthGate can bounce the user
 * to login regardless of which screen issued the call.
 *
 * The event must NOT fire on non-auth errors (the contract — we
 * don't bounce the user just because provisioning failed). And the
 * underlying exception must still be re-thrown (the caller still
 * needs to see the failure).
 */

// deno-lint-ignore no-explicit-any
function fakeChannel(send: (req: any) => Promise<any>): Channel {
  return {
    send,
    onNotification: () => {},
  } as unknown as Channel;
}

/** Captures every SESSION_EXPIRED event fired during fn(); returns the count + cleanup. */
function captureExpired<T>(fn: () => Promise<T>): Promise<{ count: number; value: T }> {
  let count = 0;
  const handler = () => {
    count++;
  };
  sessionExpired.addEventListener(SESSION_EXPIRED, handler);
  return fn()
    .then((value) => ({ count, value }))
    .catch((err) => {
      sessionExpired.removeEventListener(SESSION_EXPIRED, handler);
      throw err;
    })
    .then((result) => {
      sessionExpired.removeEventListener(SESSION_EXPIRED, handler);
      return result;
    });
}

describe("SessionExpiryClient — happy path", () => {
  it("passes a successful RPC response through unchanged (no expiry event fired)", async () => {
    /* @Given a channel that returns success */
    const client = new SessionExpiryClient(
      fakeChannel((req: unknown) =>
        Promise.resolve({ jsonrpc: "2.0", id: (req as { id: number }).id, result: { ok: true } })
      ),
    );
    /* @When the client invokes any method */
    const { count, value } = await captureExpired(() => client.invoke("cluster.list", {}));
    /* @Then the result comes back unchanged */
    assertEquals(value, { ok: true });
    /* @And NO SESSION_EXPIRED event was emitted (happy path is silent) */
    assertEquals(count, 0);
  });
});

describe("SessionExpiryClient — unauthenticated mapping", () => {
  it("emits SESSION_EXPIRED when the server returns the Unauthenticated error code", async () => {
    /* @Given a channel that returns the Unauthenticated wire error */
    const client = new SessionExpiryClient(fakeChannel((req: unknown) =>
      Promise.resolve({
        jsonrpc: "2.0",
        id: (req as { id: number }).id,
        error: { code: ErrorCode.UNAUTHENTICATED, message: "session expired" },
      })
    ));
    /* @When the client invokes any method (the screen behind it is irrelevant) */
    let count = 0;
    const handler = () => {
      count++;
    };
    sessionExpired.addEventListener(SESSION_EXPIRED, handler);
    try {
      /* @Then the call still rejects with the original Exception */
      await assertRejects(() => client.invoke("cluster.list", {}), Exception, "session expired");
      /* @And SESSION_EXPIRED was emitted exactly once (AuthGate bounces the user) */
      assertEquals(count, 1);
    } finally {
      sessionExpired.removeEventListener(SESSION_EXPIRED, handler);
    }
  });
});

describe("SessionExpiryClient — non-auth errors", () => {
  it("does NOT emit SESSION_EXPIRED when the error is anything other than Unauthenticated", async () => {
    /* @Given a channel that returns a method-not-found error (not auth) */
    const client = new SessionExpiryClient(fakeChannel((req: unknown) =>
      Promise.resolve({
        jsonrpc: "2.0",
        id: (req as { id: number }).id,
        error: { code: -32601, message: "method not found" },
      })
    ));

    let count = 0;
    const handler = () => {
      count++;
    };
    sessionExpired.addEventListener(SESSION_EXPIRED, handler);
    try {
      /* @Then the call still rejects with the original Exception */
      await assertRejects(() => client.invoke("nope", {}), Exception, "method not found");
      /* @And the SESSION_EXPIRED event is NOT fired */
      /*       (the user shouldn't be bounced just because a method was renamed) */
      assertEquals(count, 0);
    } finally {
      sessionExpired.removeEventListener(SESSION_EXPIRED, handler);
    }
  });
});
