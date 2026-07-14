import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import { ErrorCode } from "@jsonrpc-client-ts/error/error-code.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  AuthConfigureResponse,
  AuthTokenCurrentResponse,
  AuthTokenGenerateResponse,
  AuthTokenRevokeResponse,
} from "@jsonrpc-contracts-ts/auth.gen.ts";
import { buildClient, testContainer } from "@tests/auth/fixtures/bootstrap.ts";
import { Persistence } from "@tests/auth/integration/outbound/persistence.ts";

/**
 * `auth.token.*` endpoints — integration. Exercises minting a scoped
 * MCP access token from an authenticated session, reading it back,
 * and revoking it, over the JSON-RPC envelope.
 */
describe("auth.token.* endpoints — integration", () => {
  let rpc: Client;
  let persistence: Persistence;
  let session: AuthConfigureResponse;

  beforeAll(async () => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);
    session = await rpc.invoke<AuthConfigureResponse>("auth.configure", {
      password: "my-secure-password",
    });
  });

  afterAll(() => persistence.teardown());

  it("generate mints a token carrying the requested scopes", async () => {
    /* @Given an authenticated session */
    /* @When a token is generated for two scopes with a 30-day ttl */
    const token = await rpc.invoke<AuthTokenGenerateResponse>("auth.token.generate", {
      sessionId: session.sessionId,
      scopes: ["clusters:read", "clusters:provision:plan"],
      ttlDays: 30,
    });
    /* @Then the summary carries the scopes, purpose mcp, and an expiry */
    assertEquals(token.purpose, "mcp");
    assertEquals(token.scopes, ["clusters:read", "clusters:provision:plan"]);
    assertEquals(token.expiresAt !== null, true);
    assertEquals(token.id.length, 36);
  });

  it("current reports the stored token without key material", async () => {
    /* @Given a token was generated above */
    /* @When the current token is queried */
    const state = await rpc.invoke<AuthTokenCurrentResponse>("auth.token.current", {
      sessionId: session.sessionId,
    });
    /* @Then it is present with the scopes — and no `key`/`secret` field */
    assertEquals(state.present, true);
    assertEquals(state.scopes, ["clusters:read", "clusters:provision:plan"]);
    assertEquals("key" in state, false);
    assertEquals("secret" in state, false);
  });

  it("generate with a null ttl falls back to the default lifetime (never eternal over the wire)", async () => {
    /* @Given a mint request that leaves the ttl unset */
    const token = await rpc.invoke<AuthTokenGenerateResponse>("auth.token.generate", {
      sessionId: session.sessionId,
      scopes: ["stations:read"],
      ttlDays: null,
    });
    /* @Then the minted token is bounded — the wire cannot produce a never-expiring token */
    assertEquals(token.expiresAt !== null, true);
  });

  it("revoke deletes the token; current then reports none", async () => {
    /* @Given a token exists */
    /* @When it is revoked */
    const revoked = await rpc.invoke<AuthTokenRevokeResponse>("auth.token.revoke", {
      sessionId: session.sessionId,
    });
    assertEquals(revoked.revoked, true);
    /* @Then current reports no token */
    const state = await rpc.invoke<AuthTokenCurrentResponse>("auth.token.current", {
      sessionId: session.sessionId,
    });
    assertEquals(state.present, false);
  });

  it("generate rejects an unknown session", async () => {
    /* @Given a session id that was never opened */
    /* @When a token generation is attempted */
    /* @Then the server replies unauthenticated */
    const error = await assertRejects(
      () =>
        rpc.invoke<AuthTokenGenerateResponse>("auth.token.generate", {
          sessionId: "00000000-0000-0000-0000-000000000000",
          scopes: ["clusters:read"],
        }),
      Exception,
    );
    assertEquals(error.code, ErrorCode.UNAUTHENTICATED);
  });
});
