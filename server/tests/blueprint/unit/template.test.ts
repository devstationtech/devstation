import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { resolve } from "@server/blueprint/parser/template/resolve/resolve.ts";
import { preresolveSecrets } from "@server/blueprint/parser/template/secrets.ts";
import type { Context as StepContext } from "@server/blueprint/contracts/step/context/context.ts";
import type { Peer } from "@server/blueprint/contracts/step/context/peer.ts";

function fakeContext(opts: {
  inputs?: Record<string, string>;
  secrets?: Record<string, string>;
  role?: string;
  host?: string;
  peers?: Record<string, Peer[]>;
}): StepContext {
  return {
    inputs: {
      string: (n: string) => {
        const v = opts.inputs?.[n];
        if (v === undefined) throw new Error(`unknown input ${n}`);
        return v;
      },
      number: () => 0,
      boolean: () => false,
    },
    secrets: {
      get: (n: string) => Promise.resolve(opts.secrets?.[n] ?? ""),
      put: () => Promise.resolve(),
    },
    ssh: {
      run: () => Promise.resolve({ exitCode: 0, stdout: "", stderr: "" }),
      upload: () => Promise.resolve(),
    },
    role: { name: opts.role ?? "main" },
    host: opts.host ?? "10.0.0.1",
    fromRole: (n: string) => {
      const peers = opts.peers?.[n];
      if (!peers || peers.length === 0) throw new Error(`role '${n}' has no peers`);
      return { first: () => peers[0], all: () => peers };
    },
  };
}

it("resolve — substitutes ${inputs.X}", () => {
  /* @Given a template with inputs */
  const ctx = fakeContext({ inputs: { port: "8080" } });

  /* @When resolving */
  const out = resolve("listen on ${inputs.port}", { ctx, host: "1.1.1.1" });

  /* @Then the input is interpolated */
  assertEquals(out, "listen on 8080");
});

it("resolve — substitutes ${role} and ${host}", () => {
  /* @Given context with role and host */
  const ctx = fakeContext({ role: "server", host: "10.0.0.5" });

  /* @When resolving */
  const out = resolve("on ${role}@${host}", { ctx, host: "10.0.0.5" });

  /* @Then values are expanded */
  assertEquals(out, "on server@10.0.0.5");
});

it("resolve — substitutes ${peer.role.host} sugar (index 0)", () => {
  /* @Given a single peer in the 'server' role */
  const peer: Peer = { role: { name: "server" }, host: "10.0.0.1", secrets: {}, outputs: {} };
  const ctx = fakeContext({ peers: { server: [peer] } });

  /* @When resolving with sugar */
  const out = resolve("https://${peer.server.host}:6443", { ctx, host: "1.1.1.1" });

  /* @Then it uses peer[0] */
  assertEquals(out, "https://10.0.0.1:6443");
});

it("resolve — substitutes ${peer.role[N].secrets.X}", () => {
  /* @Given a peer with a published secret */
  const peer: Peer = {
    role: { name: "server" },
    host: "10.0.0.1",
    secrets: { token: "abc" },
    outputs: {},
  };
  const ctx = fakeContext({ peers: { server: [peer] } });

  /* @When referencing an indexed secret */
  const out = resolve("token=${peer.server[0].secrets.token}", { ctx, host: "1.1.1.1" });

  /* @Then it emits the value */
  assertEquals(out, "token=abc");
});

it("resolve — throws on unknown placeholder", () => {
  /* @Given an unsupported placeholder */
  const ctx = fakeContext({});

  /* @Then resolve throws */
  assertThrows(
    () => resolve("hello ${nonsense}", { ctx, host: "" }),
    Error,
    "unknown template placeholder",
  );
});

it("resolve — throws on inline ${secrets.X} (must preresolve)", () => {
  const ctx = fakeContext({ secrets: { token: "abc" } });
  assertThrows(
    () => resolve("token=${secrets.token}", { ctx, host: "" }),
    Error,
    "secrets are async",
  );
});

it("preresolveSecrets — replaces secrets before sync resolve", async () => {
  /* @Given context with resolved secrets */
  const ctx = fakeContext({ secrets: { token: "abc-token" } });

  /* @When pre-resolving */
  const out = await preresolveSecrets("auth=${secrets.token}", ctx);

  /* @Then inline vault value */
  assertEquals(out, "auth=abc-token");
});

describe("resolve — peer placeholder branches", () => {
  const peerWith = (over: Partial<Peer> = {}): Peer => ({
    role: { name: "server" },
    host: "10.0.0.1",
    secrets: {},
    outputs: {},
    ...over,
  });

  it("substitutes ${peer.role.outputs.X} (sugar form, index 0)", () => {
    /* @Given a peer that published an output */
    const ctx = fakeContext({ peers: { server: [peerWith({ outputs: { api: "https://k3s" } })] } });
    /* @Then the output value is interpolated */
    assertEquals(
      resolve("url=${peer.server.outputs.api}", { ctx, host: "1.1.1.1" }),
      "url=https://k3s",
    );
  });

  it("substitutes ${peer.role[N].host} against the Nth peer", () => {
    /* @Given two peers of role 'agent' */
    const ctx = fakeContext({
      peers: { agent: [peerWith({ host: "10.0.0.1" }), peerWith({ host: "10.0.0.2" })] },
    });
    /* @Then [1] picks the second */
    assertEquals(resolve("${peer.agent[1].host}", { ctx, host: "x" }), "10.0.0.2");
  });

  it("throws when the peer index is out of range", () => {
    /* @Given a role with a single peer */
    const ctx = fakeContext({ peers: { server: [peerWith()] } });
    /* @When index 5 is requested */
    /* @Then it throws naming the count and the bad index */
    assertThrows(
      () => resolve("${peer.server[5].host}", { ctx, host: "x" }),
      Error,
      "out of range",
    );
  });

  it("throws on a malformed peer placeholder (no field)", () => {
    const ctx = fakeContext({ peers: { server: [peerWith()] } });
    assertThrows(
      () => resolve("${peer.server}", { ctx, host: "x" }),
      Error,
      "expected peer.<role>",
    );
  });

  it("throws when the referenced secret was not published by the peer", () => {
    /* @Given a peer with no secrets */
    const ctx = fakeContext({ peers: { server: [peerWith()] } });
    /* @Then referencing a secret throws naming the missing key */
    assertThrows(
      () => resolve("${peer.server.secrets.token}", { ctx, host: "x" }),
      Error,
      "did not publish secret 'token'",
    );
  });

  it("throws when the referenced output was not published by the peer", () => {
    const ctx = fakeContext({ peers: { server: [peerWith()] } });
    assertThrows(
      () => resolve("${peer.server.outputs.api}", { ctx, host: "x" }),
      Error,
      "did not publish output 'api'",
    );
  });

  it("throws on an unknown peer field (not host/secrets.*/outputs.*)", () => {
    const ctx = fakeContext({ peers: { server: [peerWith()] } });
    assertThrows(
      () => resolve("${peer.server.cpu}", { ctx, host: "x" }),
      Error,
      "unknown field 'cpu'",
    );
  });
});
