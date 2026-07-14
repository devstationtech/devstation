/// <reference types="@types/react" />
import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { orderServiceTree } from "@ui/station/detail.tsx";
import type { StationServiceRecord } from "@jsonrpc-contracts-ts/station.gen.ts";

/**
 * The station detail view renders services as a host→hosted tree so a hosted
 * service reads as nested under the service it runs on (docker → portainer →
 * npm). `orderServiceTree` produces that depth-first order + a depth per row;
 * length is preserved so cursor navigation stays aligned with the screen.
 */

function svc(id: string, name: string, hostServiceId?: string): StationServiceRecord {
  return {
    id,
    name,
    blueprint: name,
    status: "REGISTERED",
    instances: [],
    host: hostServiceId
      ? { serviceId: hostServiceId, serviceName: hostServiceId, role: "main" }
      : null,
    lastInstalledAt: null,
  } as unknown as StationServiceRecord;
}

const shape = (out: { service: StationServiceRecord; depth: number }[]) =>
  out.map((o) => `${"  ".repeat(o.depth)}${o.service.id}`);

describe("orderServiceTree", () => {
  it("nests a hosted chain under its host, depth-first", () => {
    /* @Given docker ← portainer ← npm, passed in arbitrary order */
    const docker = svc("docker", "docker");
    const portainer = svc("portainer", "portainer", "docker");
    const npm = svc("npm", "npm", "portainer");
    const out = orderServiceTree([npm, docker, portainer]);
    /* @Then the tree is docker(0) → portainer(1) → npm(2) */
    assertEquals(shape(out), ["docker", "  portainer", "    npm"]);
    assertEquals(out.length, 3);
  });

  it("lists multiple standalone roots and their children", () => {
    /* @Given two roots, one with two hosted children */
    const docker = svc("docker", "docker");
    const portainer = svc("portainer", "portainer", "docker");
    const npm = svc("npm", "npm", "portainer");
    const k3s = svc("k3s", "k3s");
    const argocd = svc("argocd", "argocd", "k3s");
    const out = orderServiceTree([docker, portainer, npm, k3s, argocd]);
    assertEquals(shape(out), [
      "docker",
      "  portainer",
      "    npm",
      "k3s",
      "  argocd",
    ]);
  });

  it("treats a service whose host is outside the station as a root", () => {
    /* @Given a hosted service pointing at an absent host id */
    const orphan = svc("route", "route", "missing-host");
    const out = orderServiceTree([orphan]);
    /* @Then it renders at depth 0 rather than vanishing */
    assertEquals(shape(out), ["route"]);
  });

  it("never drops a service even under a hosting cycle", () => {
    /* @Given a→b and b→a (corrupt persisted data) */
    const a = svc("a", "a", "b");
    const b = svc("b", "b", "a");
    const out = orderServiceTree([a, b]);
    /* @Then both survive (appended flat by the safety net) */
    assertEquals(out.length, 2);
    assertEquals(new Set(out.map((o) => o.service.id)), new Set(["a", "b"]));
  });
});
