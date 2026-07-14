import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { EndpointRegistry } from "@server/shared/inbound/rpc/endpoint/endpoint-registry.ts";
import { Authenticated } from "@server/shared/inbound/rpc/endpoint/authenticated.ts";
import type { Endpoint } from "@server/shared/inbound/rpc/endpoint/endpoint.ts";
import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  AuthenticatedSession,
  Authentication,
} from "@server/shared/authentication/domain/ports/outbound/authentication.ts";

/**
 * EndpointRegistry is the authorization boundary at composition time:
 * `.public()` and `.protected()` declare intent; the type system
 * forbids the dangerous swap (protected-as-public won't compile).
 * Tests pin the runtime contract: registration, duplicate refusal,
 * lookup, and the Authenticated wrapping for protected entries.
 */

const stubAuth: Authentication = {
  check: (_sessionId: string) => ({ key: "k" } as unknown as AuthenticatedSession),
};

function publicEndpoint(
  method: string,
): Endpoint<string, Record<string, unknown>, Record<string, unknown>> {
  return {
    method,
    dispatch: () => Promise.resolve({ ok: true }),
  };
}

function protectedEndpoint(
  method: string,
): ProtectedEndpoint<string, { sessionId: string }, Record<string, unknown>> {
  return {
    method,
    dispatch: (_req, session) =>
      Promise.resolve({ method, sessionKey: (session as { key: string }).key }),
  };
}

describe("EndpointRegistry.public", () => {
  it("registers a public endpoint by its method name", () => {
    /* @Given a fresh registry and a public endpoint */
    const reg = EndpointRegistry.empty(stubAuth).public(publicEndpoint("rpc.version"));
    /* @When find is called */
    /* @Then the endpoint is reachable under its method name */
    assertEquals(reg.find("rpc.version")?.method, "rpc.version");
  });

  it("does NOT wrap a public endpoint with Authenticated (no session check needed)", () => {
    const reg = EndpointRegistry.empty(stubAuth).public(publicEndpoint("rpc.version"));
    const found = reg.find("rpc.version");
    /* @Then the registered instance is the raw endpoint, not the auth decorator */
    assertEquals(found instanceof Authenticated, false);
  });
});

describe("EndpointRegistry.protected", () => {
  it("registers a protected endpoint wrapped in Authenticated", () => {
    /* @Given a protected endpoint */
    const reg = EndpointRegistry.empty(stubAuth).protected(protectedEndpoint("cluster.list"));
    const found = reg.find("cluster.list");
    /* @Then it is reachable AND wrapped in Authenticated (session check runs first) */
    assertEquals(found?.method, "cluster.list");
    assertEquals(found instanceof Authenticated, true);
  });

  it("the Authenticated wrapper calls authentication.check before delegating dispatch", async () => {
    /* @Given a protected endpoint with a tracking Authentication */
    const seenSessions: string[] = [];
    const tracking: Authentication = {
      check: (sid: string) => {
        seenSessions.push(sid);
        return { key: `k-for-${sid}` } as unknown as AuthenticatedSession;
      },
    };
    const reg = EndpointRegistry.empty(tracking).protected(protectedEndpoint("cluster.list"));
    const found = reg.find("cluster.list")!;

    /* @When dispatch is invoked with a sessionId */
    const result = await found.dispatch({ sessionId: "sid-1" }) as { sessionKey: string };

    /* @Then check was called with the sessionId before the inner endpoint ran */
    assertEquals(seenSessions, ["sid-1"]);
    /* @And the inner endpoint received the session yielded by check */
    assertEquals(result.sessionKey, "k-for-sid-1");
  });
});

describe("EndpointRegistry — duplicate registration", () => {
  it("rejects two endpoints with the same method (loud failure at composition time)", () => {
    /* @Given a registry with a 'cluster.list' protected endpoint already registered */
    const reg = EndpointRegistry.empty(stubAuth).protected(protectedEndpoint("cluster.list"));
    /* @When a second endpoint tries to register the same method */
    /* @Then it throws — a silent override would let a bug or rebase shadow a method */
    assertThrows(
      () => reg.protected(protectedEndpoint("cluster.list")),
      Error,
      "duplicate endpoint: cluster.list",
    );
  });

  it("rejects when a public registration would shadow a protected one (same method)", () => {
    /* @Given a registry where 'cluster.list' is already protected */
    const reg = EndpointRegistry.empty(stubAuth).protected(protectedEndpoint("cluster.list"));
    /* @When a public 'cluster.list' is added */
    /* @Then duplicate is detected — the registry does not allow shadowing across visibility tiers */
    assertThrows(
      () => reg.public(publicEndpoint("cluster.list")),
      Error,
      "duplicate endpoint",
    );
  });
});

describe("EndpointRegistry.find", () => {
  it("returns undefined for unknown methods (caller maps to method-not-found)", () => {
    /* @Given an empty registry */
    /* @When find is called for an unregistered method */
    /* @Then undefined is returned (caller layer maps to -32601 method-not-found) */
    const reg = EndpointRegistry.empty(stubAuth);
    assertEquals(reg.find("nonexistent.method"), undefined);
  });

  it("returns the exact same instance across multiple find() calls (idempotent)", () => {
    const reg = EndpointRegistry.empty(stubAuth).public(publicEndpoint("rpc.version"));
    const a = reg.find("rpc.version");
    const b = reg.find("rpc.version");
    assertEquals(a === b, true);
  });
});

describe("EndpointRegistry — chaining", () => {
  it("supports fluent chaining of multiple public + protected registrations", () => {
    /* @Given a registry built by chaining .public + .protected + .public */
    const reg = EndpointRegistry.empty(stubAuth)
      .public(publicEndpoint("rpc.version"))
      .protected(protectedEndpoint("cluster.list"))
      .protected(protectedEndpoint("vault.list"))
      .public(publicEndpoint("auth.configured"));
    /* @Then all four are reachable, public ones unwrapped, protected ones wrapped */
    assertEquals(reg.find("rpc.version") instanceof Authenticated, false);
    assertEquals(reg.find("cluster.list") instanceof Authenticated, true);
    assertEquals(reg.find("vault.list") instanceof Authenticated, true);
    assertEquals(reg.find("auth.configured") instanceof Authenticated, false);
  });
});
