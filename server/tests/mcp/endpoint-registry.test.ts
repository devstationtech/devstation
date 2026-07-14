import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { EndpointRegistry } from "@server/shared/inbound/mcp/endpoint/endpoint-registry.ts";
import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import { McpAuth } from "@server/shared/inbound/mcp/auth/mcp-auth.ts";
import { McpPolicy } from "@server/shared/inbound/mcp/policy/mcp-policy.ts";
import { PolicyViolation } from "@server/shared/inbound/mcp/policy/violation.ts";

/**
 * `EndpointRegistry` — proves the dispatch + wire-envelope contract
 * and the scope gate: `.public()` endpoints are always reachable;
 * `.protected(endpoint, scope)` ones are withheld from `list()` and
 * refused by `call()` unless the boot-time `McpAuth` grants that scope.
 */

const NO_AUTH = McpAuth.none();

/** Trivial endpoint that echoes its args back as the result. */
const echo: Endpoint<"echo", { v: number }, { v: number }> = {
  name: "echo",
  title: "Echo",
  description: "Returns the input verbatim.",
  risk: "read",
  inputSchema: { type: "object", properties: { v: { type: "number" } }, required: ["v"] },
  dispatch(args) {
    return { v: args.v };
  },
};

/** A state-changing endpoint — registered via `.protected()`. */
const mutate: Endpoint<"mutate", Record<string, unknown>, { ok: true }> = {
  name: "mutate",
  title: "Mutate",
  description: "Changes state.",
  risk: "mutating",
  inputSchema: { type: "object" },
  dispatch() {
    return { ok: true };
  },
};

describe("EndpointRegistry — dispatch + wire envelope", () => {
  it("registers a public endpoint and lists it with [risk]-prefixed description", () => {
    const r = EndpointRegistry.empty(NO_AUTH).public(echo);
    const list = r.list();
    assertEquals(list.length, 1);
    assertEquals(list[0].name, "echo");
    assertEquals(list[0].description, "[read] Returns the input verbatim.");
  });

  it("dispatches a public endpoint and wraps the JSON result in the wire envelope", async () => {
    const r = EndpointRegistry.empty(NO_AUTH).public(echo);
    const res = await r.call("echo", { v: 42 }, { policy: McpPolicy.OFF });
    assertEquals(res.isError ?? false, false);
    assertEquals(JSON.parse(res.content[0].text), { v: 42 });
  });

  it("unknown name returns isError without throwing", async () => {
    const r = EndpointRegistry.empty(NO_AUTH);
    const res = await r.call("nope", {}, { policy: McpPolicy.OFF });
    assertEquals(res.isError, true);
    assertEquals(res.content[0].text, "unknown tool: nope");
  });

  it("PolicyViolation thrown by dispatch becomes isError + message verbatim", async () => {
    const guarded: Endpoint<"guarded", Record<string, unknown>, never> = {
      name: "guarded",
      title: "Guarded",
      description: "Throws on dispatch.",
      risk: "destructive",
      inputSchema: { type: "object" },
      dispatch(_args, ctx) {
        ctx.policy.requirePrefix("untrusted-target");
        throw new Error("unreachable");
      },
    };
    const policy = McpPolicy.load("prefix:ds-e2e-");
    const r = EndpointRegistry.empty(NO_AUTH).public(guarded);
    const res = await r.call("guarded", {}, { policy });
    assertEquals(res.isError, true);
    assertEquals(res.content[0].text.includes("does not carry any of the configured"), true);
  });

  it("generic Error thrown by dispatch becomes isError with its message", async () => {
    const broken: Endpoint<"broken", Record<string, unknown>, never> = {
      name: "broken",
      title: "Broken",
      description: "Throws.",
      risk: "read",
      inputSchema: { type: "object" },
      dispatch() {
        throw new Error("kaput");
      },
    };
    const r = EndpointRegistry.empty(NO_AUTH).public(broken);
    const res = await r.call("broken", {}, { policy: McpPolicy.OFF });
    assertEquals(res.isError, true);
    assertEquals(res.content[0].text, "kaput");
  });

  it("rejects duplicate names", () => {
    const r = EndpointRegistry.empty(NO_AUTH).public(echo);
    try {
      r.public(echo);
      throw new Error("should have thrown");
    } catch (err) {
      assertEquals(err instanceof Error && err.message.includes("duplicate MCP endpoint"), true);
    }
  });

  it("PolicyViolation matches its message even when caught", () => {
    const v = new PolicyViolation("refused: x");
    assertEquals(v.message, "refused: x");
    assertEquals(v instanceof Error, true);
  });
});

describe("EndpointRegistry — scope gate", () => {
  it("public endpoints are listed + callable regardless of granted scopes", async () => {
    /* @Given a registry with no granted scopes */
    const r = EndpointRegistry.empty(NO_AUTH).public(echo).protected(mutate, "things:write");
    /* @Then the public endpoint shows + dispatches */
    assertEquals(r.list().map((e) => e.name), ["echo"]);
    const res = await r.call("echo", { v: 1 }, { policy: McpPolicy.OFF });
    assertEquals(res.isError ?? false, false);
  });

  it("an ungranted scope withholds the endpoint from list()", () => {
    const r = EndpointRegistry.empty(McpAuth.of(["other:read"]))
      .public(echo)
      .protected(mutate, "things:write");
    assertEquals(r.list().map((e) => e.name), ["echo"]);
  });

  it("calling an ungranted scoped endpoint is refused, naming the scope", async () => {
    /* @Given a protected endpoint whose scope is not granted */
    const r = EndpointRegistry.empty(NO_AUTH).protected(mutate, "things:write");
    /* @When it is called */
    const res = await r.call("mutate", {}, { policy: McpPolicy.OFF });
    /* @Then it is refused, naming the required scope */
    assertEquals(res.isError, true);
    assertEquals(res.content[0].text.includes("things:write"), true);
  });

  it("a granted scope makes the endpoint listed AND dispatchable", async () => {
    /* @Given the registry built with the matching scope granted */
    const r = EndpointRegistry.empty(McpAuth.of(["things:write"]))
      .public(echo)
      .protected(mutate, "things:write");
    /* @Then both endpoints are advertised */
    assertEquals(r.list().map((e) => e.name).sort(), ["echo", "mutate"]);
    /* @And the scoped one dispatches */
    const res = await r.call("mutate", {}, { policy: McpPolicy.OFF });
    assertEquals(res.isError ?? false, false);
    assertEquals(JSON.parse(res.content[0].text), { ok: true });
  });

  it("scopes gate independently — one granted does not unlock another", () => {
    /* @Given two scoped endpoints, only one scope granted */
    const r = EndpointRegistry.empty(McpAuth.of(["a:read"]))
      .protected(echo, "a:read")
      .protected(mutate, "b:write");
    /* @Then only the granted-scope endpoint is reachable */
    assertEquals(r.list().map((e) => e.name), ["echo"]);
  });
});

describe("McpAuth", () => {
  it("of(scopes) grants exactly those scopes", () => {
    const auth = McpAuth.of(["clusters:read", "stations:write"]);
    assertEquals(auth.grants("clusters:read"), true);
    assertEquals(auth.grants("stations:write"), true);
    assertEquals(auth.grants("clusters:write"), false);
  });

  it("none() grants nothing", () => {
    assertEquals(McpAuth.none().grants("clusters:read"), false);
    assertEquals(McpAuth.none().granted, []);
  });

  it("granted lists the scopes, sorted", () => {
    assertEquals(McpAuth.of(["stations:write", "clusters:read"]).granted, [
      "clusters:read",
      "stations:write",
    ]);
  });
});
