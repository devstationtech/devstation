import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { RegisterServiceEndpoint } from "@server/station/inbound/rpc/services/register/endpoint.ts";
import type { RegisterServiceHandler } from "@server/station/application/handlers/register-service-handler.ts";
import type { RegisterService } from "@server/station/application/commands/register-service.ts";
import type { StationServicesRegisterRequest } from "@jsonrpc-contracts-ts/station.gen.ts";

/**
 * `station.services.register` endpoint — thin inbound adapter. Pins
 * the request→command mapping and the two optional branches: a
 * standalone request carries `instances` (→ array, defensively
 * copied) with `host: null`; a hosted request carries `host` (→
 * object copy) with `instances: null`.
 */

// deno-lint-ignore no-explicit-any
type Anyish = any;

function fakeHandler(): { handler: RegisterServiceHandler; calls: RegisterService[] } {
  const calls: RegisterService[] = [];
  const handler = {
    handle(cmd: RegisterService): Promise<void> {
      calls.push(cmd);
      return Promise.resolve();
    },
  } as Anyish as RegisterServiceHandler;
  return { handler, calls };
}

const BASE = {
  sessionId: "sess",
  stationId: "st1",
  name: "k3s",
  blueprint: "k3s-bp",
  vaultId: "v1",
  inputs: { port: 6443 },
  secrets: { token: "s1" },
  user: "alice",
  hostname: "workstation",
};

describe("RegisterServiceEndpoint", () => {
  it("declares the method literal", () => {
    const { handler } = fakeHandler();
    assertEquals(new RegisterServiceEndpoint(handler).method, "station.services.register");
  });

  it("maps a standalone request (instances set, host null) onto the command", async () => {
    /* @Given a standalone registration with one instance */
    const { handler, calls } = fakeHandler();
    const request = {
      ...BASE,
      instances: [{
        role: "main",
        host: "10.0.0.5",
        credentialVaultId: "cv",
        usernameSecretId: "us",
        passwordSecretId: "ps",
      }],
      host: null,
    } as Anyish as StationServicesRegisterRequest;
    /* @When dispatched */
    const ack = await new RegisterServiceEndpoint(handler).dispatch(request);
    /* @Then the command carries the instances and a null host */
    assertEquals(calls.length, 1);
    assertEquals(calls[0].stationId, "st1");
    assertEquals(calls[0].name, "k3s");
    assertEquals(calls[0].instances?.length, 1);
    assertEquals(calls[0].instances?.[0].role, "main");
    assertEquals(calls[0].host, null);
    assertEquals(ack, {});
  });

  it("maps a hosted request (host set, instances null) onto the command", async () => {
    /* @Given a hosted registration pointing at a host service+role */
    const { handler, calls } = fakeHandler();
    const request = {
      ...BASE,
      instances: null,
      host: { serviceId: "host-svc", role: "server" },
    } as Anyish as StationServicesRegisterRequest;
    /* @When dispatched */
    await new RegisterServiceEndpoint(handler).dispatch(request);
    /* @Then the command carries the host ref and null instances */
    assertEquals(calls[0].instances, null);
    assertEquals(calls[0].host, { serviceId: "host-svc", role: "server" });
  });

  it("defensively copies instances + host (caller mutation cannot reach the command)", async () => {
    /* @Given a standalone request whose instances array is mutated post-dispatch */
    const { handler, calls } = fakeHandler();
    const instances = [{
      role: "main",
      host: "10.0.0.5",
      credentialVaultId: "cv",
      usernameSecretId: "us",
      passwordSecretId: "ps",
    }];
    const request = { ...BASE, instances, host: null } as Anyish as StationServicesRegisterRequest;
    await new RegisterServiceEndpoint(handler).dispatch(request);
    instances.push({ role: "evil" } as Anyish);
    /* @Then the command kept its own one-element copy */
    assertEquals(calls[0].instances?.length, 1);
  });
});
