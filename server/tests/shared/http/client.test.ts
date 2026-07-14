import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { HttpClient } from "@server/shared/http/outbound/client.ts";

/**
 * Pins the HttpClient TLS-skip invariants. `Deno.createHttpClient(
 * {unsafelyIgnoreCertificateErrors: [...]})` is a runtime no-op;
 * Deno only honors the toggle when the runtime is launched with the
 * matching CLI flag, so the engine's `deno compile` bakes
 * `--unsafely-ignore-certificate-errors` into the binary.
 *
 * That makes the HttpClient simpler: no custom client, no
 * `init.client` plumbing — `fetch` always takes the default surface
 * and the cert skip lives one layer up (in the compiled binary).
 *
 * This test pins both invariants:
 *   1. The adapter never builds a custom `Deno.HttpClient` (it would
 *      be dead weight — a no-op).
 *   2. `skipTlsVerification: true` is accepted for forward compat and
 *      does NOT throw — just like `skipTlsVerification: false` /
 *      omitted. If we ever go back to a per-request approach, this
 *      test stays the contract: skip happens, no crash.
 */
describe("HttpClient — TLS skip is engine-level, not per-request", () => {
  it("does NOT construct a custom Deno.HttpClient regardless of skipTlsVerification", async () => {
    /* @Given Deno.createHttpClient + fetch spied/stubbed */
    let createCount = 0;
    const ogCreate = Deno.createHttpClient;
    const ogFetch = globalThis.fetch;

    Deno.createHttpClient = (opts: Deno.CreateHttpClientOptions) => {
      createCount++;
      // Real return so a re-introduction of the bad path still compiles.
      return ogCreate(opts);
    };
    globalThis.fetch = () => Promise.resolve(new Response("{}", { status: 200 }));

    /* @When GET runs with skipTlsVerification omitted / false / true */
    try {
      // All three variants of the flag must take the SAME path now.
      await new HttpClient().get("https://example.com/api");
      await new HttpClient().get("https://example.com/api", {
        skipTlsVerification: false,
      });
      await new HttpClient().get("https://example.com/api", {
        skipTlsVerification: true,
      });
    } finally {
      Deno.createHttpClient = ogCreate;
      globalThis.fetch = ogFetch;
    }

    /* @Then no custom Deno.HttpClient is ever constructed */
    assertEquals(
      createCount,
      0,
      "Deno.createHttpClient is a runtime no-op for cert skip — the " +
        "adapter must not pretend otherwise. TLS skip belongs in the " +
        "compile-time CLI flag (`--unsafely-ignore-certificate-errors`).",
    );
  });

  it("accepts the forward-compat skipTlsVerification flag without changing behaviour", async () => {
    /* @Given fetch stubbed to record the requested URLs */
    const seen: string[] = [];
    const ogFetch = globalThis.fetch;
    globalThis.fetch = (input) => {
      seen.push(typeof input === "string" ? input : input.toString());
      return Promise.resolve(new Response("{}", { status: 200 }));
    };
    /* @When GET runs with and without the flag */
    try {
      const a = await new HttpClient().get("https://example.com/a");
      const b = await new HttpClient().get("https://example.com/b", {
        skipTlsVerification: true,
      });
      /* @Then both succeed identically and hit the same URLs */
      assertEquals(a.status, 200);
      assertEquals(b.status, 200);
      assertEquals(seen, ["https://example.com/a", "https://example.com/b"]);
    } finally {
      globalThis.fetch = ogFetch;
    }
  });
});
