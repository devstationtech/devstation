import { assert, assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Ssh2BootstrapAdapter } from "@server/shared/ssh/outbound/ssh2-bootstrap-adapter.ts";
import { SshBootstrapFailed } from "@server/shared/ssh/domain/ports/outbound/ssh-bootstrap.ts";

/**
 * Regression for the ssh2 adapter hang: the `ssh2` lib via Deno
 * npm:compat can enter a state where neither `ready` nor `error` fires,
 * and `client.connect()`'s own `readyTimeout` does not break the
 * silence. The adapter now wraps every stage in an absolute timeout so
 * the worst case is a clean `SshBootstrapFailed` after ~60s instead of
 * an open-ended hang.
 *
 * The test exercises the *defensive ceiling*: pass a host that won't
 * respond, assert that `installKey` rejects with a meaningful
 * `SshBootstrapFailed` within the budget. If the timeout wrapping is
 * ever removed, this test hangs and the suite times out — the exact
 * regression it is designed to catch.
 */

const UNREACHABLE_HOST = "192.0.2.1"; // TEST-NET-1, RFC 5737 — guaranteed unroutable

describe("Ssh2BootstrapAdapter — defensive timeout", () => {
  it("rejects with SshBootstrapFailed when the host is unreachable, well under the total budget", async () => {
    /* @Given the adapter and an unroutable TEST-NET-1 host */
    const adapter = new Ssh2BootstrapAdapter();
    const start = Date.now();
    /* @When installKey is attempted */
    /* @Then it rejects with SshBootstrapFailed */
    await assertRejects(
      () =>
        adapter.installKey({
          host: UNREACHABLE_HOST,
          port: 22,
          user: "root",
          password: "irrelevant",
          publicKey: "ssh-ed25519 AAAA fake@test",
        }),
      SshBootstrapFailed,
    );
    const elapsed = Date.now() - start;
    /* @And it gives up well under the runaway budget the bug produced */
    // Total budget is 60s. We expect ssh2's own readyTimeout (15s) or
    // our stage timeout (20s) to win — give some headroom but enforce
    // a ceiling well below the runaway scenario the bug produced.
    assert(
      elapsed < 35_000,
      `expected adapter to give up under 35s, took ${elapsed}ms`,
    );
  });

  it("rejects immediately when the public key is empty", async () => {
    /* @Given a whitespace-only public key */
    const adapter = new Ssh2BootstrapAdapter();
    /* @When installKey is attempted */
    /* @Then it rejects immediately with an "empty" message */
    await assertRejects(
      () =>
        adapter.installKey({
          host: "192.0.2.1",
          user: "root",
          password: "irrelevant",
          publicKey: "   ",
        }),
      SshBootstrapFailed,
      "public key is empty",
    );
  });

  it("preserves the error message inside the failure when timeout wins", async () => {
    /* @Given an unreachable host */
    const adapter = new Ssh2BootstrapAdapter();
    /* @When installKey times out and the failure is captured */
    let captured: unknown = null;
    try {
      await adapter.installKey({
        host: UNREACHABLE_HOST,
        user: "root",
        password: "irrelevant",
        publicKey: "ssh-ed25519 AAAA fake@test",
      });
    } catch (e) {
      captured = e;
    }
    /* @Then it is a SshBootstrapFailed carrying a known graceful-failure phrase */
    assert(captured instanceof SshBootstrapFailed);
    const msg = (captured as Error).message.toLowerCase();
    // Either ssh2 surfaces "ssh connect failed" or our timeout layer
    // surfaces "stalled" / "ended before handshake". Any of those is
    // a graceful failure mode — the bug was *no* message at all.
    const knownPhrases = [
      "ssh connect failed",
      "stalled",
      "ended before handshake",
      "closed before handshake",
      "exhausted",
    ];
    assertEquals(
      knownPhrases.some((p) => msg.includes(p)),
      true,
      `expected one of ${JSON.stringify(knownPhrases)} in message, got: ${msg}`,
    );
  });
});
